"""
PolarSync Simulation Core (Phase 1)
====================================
Pure, deterministic simulation logic — no Flask, no I/O.
Later phases (Maitri+Bharati multi-station, historical replay,
scenario engine, edge buffering) build on top of this module.
"""

import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict

import numpy as np


# ============================================================
# STATION IDENTITY
# ============================================================

class StationID(str, Enum):
    MAITRI = "MAITRI"
    BHARATI = "BHARATI"


# ============================================================
# SEEDABLE RANDOMNESS ABSTRACTION
# ============================================================

class SimulationRNG:
    """Thin wrapper around numpy's Generator so simulation runs
    can be made reproducible by passing a seed. Nothing in the
    simulation core should call np.random.* directly — everything
    goes through an instance of this class."""

    def __init__(self, seed: Optional[int] = None):
        self._rng = np.random.default_rng(seed)

    def uniform(self, low, high):
        return float(self._rng.uniform(low, high))

    def normal(self, mean, std):
        return float(self._rng.normal(mean, std))

    def random(self):
        return float(self._rng.random())

    def integers(self, low, high):
        # high is exclusive in numpy's Generator.integers
        return int(self._rng.integers(low, high))

    def choice(self, options):
        idx = self._rng.integers(0, len(options))
        return options[idx]


# ============================================================
# CONFIGURATION (all previously-scattered constants live here)
# ============================================================

@dataclass
class SimulationConfig:
    interval_seconds: int = 2
    simulation_time_multiplier: int = 1
    network_mode: str = "NORMAL"
    seed: Optional[int] = None
    dataset_path: Optional[str] = None

    @classmethod
    def from_env(cls, argv=None, env=None):
        argv = sys.argv if argv is None else argv
        env = os.environ if env is None else env

        interval_seconds = 2
        if "--prod" in argv or "--production" in argv:
            interval_seconds = 60
        elif "INTERVAL_SECONDS" in env:
            try:
                interval_seconds = int(env["INTERVAL_SECONDS"])
            except ValueError:
                interval_seconds = 2

        seed = None
        if "SIMULATION_SEED" in env:
            try:
                seed = int(env["SIMULATION_SEED"])
            except ValueError:
                seed = None

        return cls(
            interval_seconds=interval_seconds,
            simulation_time_multiplier=int(env.get("SIMULATION_TIME_MULTIPLIER", 1)),
            network_mode=env.get("NETWORK_MODE", "NORMAL"),
            seed=seed,
        )


# ============================================================
# STATE MODEL
# ============================================================

@dataclass
class EnvironmentState:
    temperature: float = -10.0
    air_pressure: float = 970.0
    wind_speed: float = 30.0
    wind_direction: float = 270.0
    humidity: float = 55.0
    source_type: str = "SIMULATED_ENVIRONMENTAL"
    quality: str = "VALID"
    source_timestamp: Optional[str] = None


@dataclass
class EnergyState:
    energy: float = 500.0
    generator_status: str = "RUNNING"          # RUNNING | STOPPED | FAULT
    generator_load: float = 60.0
    power_generation: float = 80.0
    power_consumption: float = 65.0
    fuel_level: float = 75.0
    battery_soc: float = 90.0
    generator_health: float = 95.0
    critical_systems_powered: bool = True       # new


@dataclass
class InfrastructureState:
    heating: float = 20.0
    pump_status: int = 1
    equipment_temperature: float = 35.0
    vibration: float = 2.0
    runtime: int = 1200
    network_status: str = "NORMAL"
    network_bandwidth: float = 0.0
    network_latency: int = 0
    packet_loss: float = 0.0
    signal_strength: int = 0
    communication_equipment_health: float = 98.0
    communication_equipment_status: str = "ONLINE"
    water_treatment_health: float = 96.0
    water_treatment_status: str = "ONLINE"
    backup_heater_health: float = 97.0
    backup_heater_active: bool = False


@dataclass
class LogisticsState:
    food_stock_kg: float = 1840.0
    food_consumption_daily_kg: float = 20.0
    food_storage_temperature: float = -18.0
    medicine_stock_units: float = 428.0
    medicine_consumption_daily: float = 3.5
    medicine_storage_temperature: float = 4.0
    generator_fuel_reserve_l: float = 200000.0  # sized for ~1 season between resupply, at ~576 L/day typical draw


@dataclass
class SimulationState:
    timestamp: datetime
    station_id: StationID
    environment: EnvironmentState = field(default_factory=EnvironmentState)
    energy: EnergyState = field(default_factory=EnergyState)
    infrastructure: InfrastructureState = field(default_factory=InfrastructureState)
    logistics: LogisticsState = field(default_factory=LogisticsState)
    active_scenarios: Dict[str, int] = field(default_factory=dict)  # scenario_type -> ticks_remaining

    def to_api_dict(self) -> dict:
        """Flatten to the exact JSON shape the existing frontend/API
        already expects, so /api/data behaviour is preserved."""
        food_days_remaining = 0
        if self.logistics.food_consumption_daily_kg > 0:
            food_days_remaining = int(
                self.logistics.food_stock_kg / self.logistics.food_consumption_daily_kg
            )
        food_status = (
            "NORMAL" if food_days_remaining > 60
            else "LOW" if food_days_remaining > 30
            else "CRITICAL"
        )

        medicine_days_remaining = 0
        if self.logistics.medicine_consumption_daily > 0:
            medicine_days_remaining = int(
                self.logistics.medicine_stock_units / self.logistics.medicine_consumption_daily
            )
        medicine_status = (
            "NORMAL" if medicine_days_remaining > 60
            else "LOW" if medicine_days_remaining > 30
            else "CRITICAL"
        )

        # Expiry risk derived fresh from current storage temperature
        # deviation -- no stored state needed, same pattern as *_status.
        def _expiry_risk(current_temp, target_temp):
            deviation = abs(current_temp - target_temp)
            if deviation > 15.0:
                return 3
            elif deviation > 8.0:
                return 2
            elif deviation > 3.0:
                return 1
            return 0

        food_expiry_risk = _expiry_risk(self.logistics.food_storage_temperature, -18.0)
        medicine_expiry_risk = _expiry_risk(self.logistics.medicine_storage_temperature, 4.0)

        # Based on power_consumption (what the station actually needs),
        # not instantaneous power_generation -- generation is correctly
        # 0 during a real outage, but that shouldn't make the fuel
        # reserve estimate collapse to "0 days," since the tank isn't
        # actually empty. This is a planning estimate, distinct from
        # tick()'s real fuel burn above (which correctly uses actual
        # generation).
        fuel_reserve_days_remaining = 0
        implied_daily_fuel_use = self.energy.power_consumption * 24.0 * 0.3
        if implied_daily_fuel_use > 0:
            fuel_reserve_days_remaining = int(
                self.logistics.generator_fuel_reserve_l / implied_daily_fuel_use
            )

        min_days = min(food_days_remaining, medicine_days_remaining, fuel_reserve_days_remaining)
        resupply_risk = (
            "CRITICAL" if min_days <= 30
            else "ELEVATED" if min_days <= 90
            else "NORMAL"
        )

        return {
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "station_id": self.station_id.value,
            "active_scenarios": list(self.active_scenarios.keys()),
            "temperature": round(self.environment.temperature, 2),
            "air_pressure": round(self.environment.air_pressure, 2),
            "wind_speed": round(self.environment.wind_speed, 2),
            "wind_direction": round(self.environment.wind_direction, 1),
            "humidity": round(self.environment.humidity, 1),
            "environment_source_type": self.environment.source_type,
            "environment_quality": self.environment.quality,
            "energy": round(self.energy.energy, 2),
            "generator_load": round(self.energy.generator_load, 2),
            "power_generation": round(self.energy.power_generation, 2),
            "power_consumption": round(self.energy.power_consumption, 2),
            "fuel_level": round(self.energy.fuel_level, 2),
            "battery_soc": round(self.energy.battery_soc, 2),
            "heating": round(self.infrastructure.heating, 2),
            "generator_health": round(self.energy.generator_health, 2),
            "pump_status": int(self.infrastructure.pump_status),
            "equipment_temperature": round(self.infrastructure.equipment_temperature, 2),
            "vibration": round(self.infrastructure.vibration, 2),
            "runtime": self.infrastructure.runtime,
            "network_status": self.infrastructure.network_status,
            "network_bandwidth": self.infrastructure.network_bandwidth,
            "network_latency": self.infrastructure.network_latency,
            "packet_loss": self.infrastructure.packet_loss,
            "signal_strength": self.infrastructure.signal_strength,
            "food_stock_kg": int(self.logistics.food_stock_kg),
            "food_days_remaining": food_days_remaining,
            "food_consumption_daily_kg": self.logistics.food_consumption_daily_kg,
            "food_storage_temperature": self.logistics.food_storage_temperature,
            "food_status": food_status,
            "food_expiry_risk": food_expiry_risk,
            "medicine_stock_units": int(self.logistics.medicine_stock_units),
            "medicine_days_remaining": medicine_days_remaining,
            "medicine_consumption_daily": self.logistics.medicine_consumption_daily,
            "medicine_expiry_risk": medicine_expiry_risk,
            "medicine_storage_temperature": self.logistics.medicine_storage_temperature,
            "medicine_status": medicine_status,
            "generator_fuel_reserve_l": round(self.logistics.generator_fuel_reserve_l, 1),
            "generator_fuel_reserve_days_remaining": fuel_reserve_days_remaining,
            "resupply_risk": resupply_risk,
            "generator_status": self.energy.generator_status,
            "critical_systems_powered": self.energy.critical_systems_powered,
            "communication_equipment_health": round(self.infrastructure.communication_equipment_health, 2),
            "communication_equipment_status": self.infrastructure.communication_equipment_status,
            "water_treatment_health": round(self.infrastructure.water_treatment_health, 2),
            "water_treatment_status": self.infrastructure.water_treatment_status,
            "backup_heater_health": round(self.infrastructure.backup_heater_health, 2),
            "backup_heater_active": self.infrastructure.backup_heater_active,
        }


def clamp(value, minimum, maximum):
    return max(minimum, min(value, maximum))


SCENARIO_TYPES = [
    "EXTREME_COLD",
    "EXTREME_WIND",
    "PRESSURE_DROP",
    "HUMIDITY_ANOMALY",
    "GENERATOR_FAILURE",
    "COMMUNICATION_FAILURE",
]


# ============================================================
# SIMULATION CORE — ONE DETERMINISTIC TICK
# ============================================================

class SimulationCore:
    """Owns one station's simulation state and advances it one
    tick at a time. All randomness flows through self.rng, so the
    same seed + same tick sequence reproduces the same run."""

    def __init__(
        self,
        station_id: StationID = StationID.MAITRI,
        config: Optional[SimulationConfig] = None,
        rng: Optional[SimulationRNG] = None,
        state: Optional[SimulationState] = None,
        environment_source=None,
    ):
        self.station_id = station_id
        self.config = config or SimulationConfig()
        self.rng = rng or SimulationRNG(self.config.seed)
        self.state = state or SimulationState(
            timestamp=datetime.now(), station_id=station_id
        )
        self.environment_source = environment_source
        self._pending_recoveries = []


    def tick(self) -> SimulationState:
        s = self.state
        cfg = self.config
        rng = self.rng
        energy, infra, log = s.energy, s.infrastructure, s.logistics

        # Recovery for scenarios that expired during the PREVIOUS tick
        # happens now, at the start of THIS tick -- mirroring how
        # EXTREME_COLD/etc. recover naturally (the environment reading
        # below overwrites the forced value one tick after expiry).
        # This keeps every scenario type consistent: the forced effect
        # is visible for exactly duration_ticks ticks, recovery is
        # visible starting the tick after.
        for scenario_type in self._pending_recoveries:
            self._end_scenario_effects(scenario_type)
        self._pending_recoveries = []


        # Pull the next environment reading (real replay for Maitri,
        # synthetic for Bharati) BEFORE anything else, so everything
        # downstream this tick can react to it.
        if self.environment_source is not None:
            reading = self.environment_source.next_reading()
            s.environment.temperature = reading.temperature
            s.environment.air_pressure = reading.air_pressure
            s.environment.wind_speed = reading.wind_speed
            s.environment.wind_direction = reading.wind_direction
            s.environment.humidity = reading.humidity
            s.environment.source_type = reading.source_type
            s.environment.quality = reading.quality
            s.environment.source_timestamp = reading.source_timestamp



        self._apply_scenario_effects()

        # The heater tries to hold equipment_temperature near a regulated
        # target. How well it succeeds depends on how much heat is being
        # lost to the outside -- mild cold, the heater keeps up easily;
        # extreme cold, the heater's capacity isn't enough and indoor
        # temperature genuinely drops. This is what makes EXTREME_COLD
        # (Phase 6) a real demo instead of a cosmetic label.

        target_indoor = 32.0
        max_heater_output = 60.0
        outside_pull = clamp(s.environment.temperature, -60.0, 5.0)

        # Wind chill: sustained high wind increases real heat loss from
        # the station envelope on top of raw air temperature. Small
        # effect at normal wind speeds, meaningful during EXTREME_WIND --
        # and compounds with EXTREME_COLD if both are active together.
        wind_chill_penalty = clamp(s.environment.wind_speed, 0.0, 200.0) * 0.05
        effective_outside_temp = outside_pull - wind_chill_penalty

        heat_loss = max(0.0, target_indoor - effective_outside_temp) * 0.6
        required_heating = clamp(15.0 + heat_loss, 0.0, max_heater_output)
        heating_deficit = max(0.0, heat_loss - (max_heater_output - 15.0))

        # Backup heater automatically engages when the primary heater
        # can't keep up and it still has health left to draw on. It
        # absorbs part of the deficit but draws extra power to do so,
        # and wears itself down faster while active.
        backup_capacity = 25.0
        backup_heater_draw = 0.0
        if heating_deficit > 0.0 and infra.backup_heater_health > 0.0:
            infra.backup_heater_active = True
            backup_contribution = min(heating_deficit, backup_capacity)
            heating_deficit = max(0.0, heating_deficit - backup_contribution)
            backup_heater_draw = 8.0
            infra.backup_heater_health = clamp(
                infra.backup_heater_health - rng.uniform(0.05, 0.15), 0.0, 100.0
            )
        else:
            infra.backup_heater_active = False
            infra.backup_heater_health = clamp(
                infra.backup_heater_health - rng.uniform(0.001, 0.01), 0.0, 100.0
            )

        equilibrium_temp = target_indoor - heating_deficit * 2.0

        infra.equipment_temperature = clamp(
            infra.equipment_temperature
            + (equilibrium_temp - infra.equipment_temperature) * 0.05
            + rng.uniform(-0.3, 0.3),
            15.0, 80.0,
        )

        infra.heating = clamp(required_heating + rng.normal(0, 2), 0.0, 60.0)

        # Water treatment and communication equipment: slow background
        # wear, with status derived from health rather than hardcoded.
        # pump_status now reflects real equipment state instead of
        # always being forced to 1.
        # High humidity accelerates corrosion/condensation-related wear
        # on water treatment equipment -- HUMIDITY_ANOMALY's real effect.
        water_wear_low, water_wear_high = 0.001, 0.01
        if s.environment.humidity > 85.0:
            water_wear_low, water_wear_high = 0.03, 0.08
        infra.water_treatment_health = clamp(
            infra.water_treatment_health - rng.uniform(water_wear_low, water_wear_high), 0.0, 100.0
        )
        if infra.water_treatment_health <= 20.0:
            infra.water_treatment_status = "OFFLINE"
        elif infra.water_treatment_health <= 50.0:
            infra.water_treatment_status = "DEGRADED"
        else:
            infra.water_treatment_status = "ONLINE"
        infra.pump_status = 0 if infra.water_treatment_status == "OFFLINE" else 1

        # Communication equipment wears faster under mechanical stress
        # from high wind (antenna/mast strain) or humidity (corrosion) --
        # EXTREME_WIND and HUMIDITY_ANOMALY both get a real effect here.
        comms_wear_low, comms_wear_high = 0.001, 0.01
        if s.environment.wind_speed > 80.0 or s.environment.humidity > 85.0:
            comms_wear_low, comms_wear_high = 0.05, 0.15
        infra.communication_equipment_health = clamp(
            infra.communication_equipment_health - rng.uniform(comms_wear_low, comms_wear_high), 0.0, 100.0
        )
        if infra.communication_equipment_health <= 20.0:
            infra.communication_equipment_status = "OFFLINE"
        elif infra.communication_equipment_health <= 50.0:
            infra.communication_equipment_status = "DEGRADED"
        else:
            infra.communication_equipment_status = "ONLINE"

        # power_consumption now responds to heating demand instead of
        # drifting independently. Baseline covers lighting, instruments,
        # comms, life support; heating adds on top of that.
        baseline_load = 40.0
        target_consumption = baseline_load + infra.heating * 0.9 + backup_heater_draw
        energy.power_consumption = clamp(
            energy.power_consumption + (target_consumption - energy.power_consumption) * 0.2
            + rng.uniform(-1.5, 1.5),
            30.0, 110.0,
        )

        # Reduced air pressure means lower oxygen density, which derates
        # a naturally-aspirated diesel generator's real output for the
        # same load -- PRESSURE_DROP's real downstream effect. Standard
        # atmosphere is ~1013 hPa; derate scales with deviation below it.
        pressure_derate = clamp(
            1.0 - max(0.0, 1013.0 - s.environment.air_pressure) * 0.0008, 0.85, 1.0
        )

        if energy.generator_status == "RUNNING":
            max_capacity = 120.0

            # Battery recharge priority: if the battery has room to
            # charge, the generator runs slightly above pure consumption
            # need to recharge it, instead of only ever matching load
            # exactly (which is why battery never recovered after an
            # outage in earlier phases).
            charge_margin = 0.0
            if energy.battery_soc < 85.0:
                charge_margin = min((85.0 - energy.battery_soc) * 0.4, 30.0)

            target_load = clamp(
                ((energy.power_consumption + charge_margin) / max_capacity) * 100.0, 20.0, 90.0
            )
            energy.generator_load = clamp(
                energy.generator_load + (target_load - energy.generator_load) * 0.3
                + rng.uniform(-1.0, 1.0),
                20.0, 90.0,
            )
            energy.power_generation = clamp(
                energy.generator_load * 1.20 * pressure_derate + rng.normal(0, 2), 20.0, 120.0
            )
        elif energy.generator_status == "FAULT":
            energy.generator_load = clamp(energy.generator_load * 0.5, 0.0, 30.0)
            energy.power_generation = clamp(
                energy.generator_load * 1.20 * pressure_derate + rng.normal(0, 2), 0.0, 40.0
            )
        else:  # STOPPED
            energy.generator_load = 0.0
            energy.power_generation = 0.0

        fuel_usage = energy.power_generation * 0.0007 + rng.uniform(0.01, 0.03)
        energy.fuel_level = clamp(energy.fuel_level - fuel_usage, 0.0, 100.0)

        energy_difference = energy.power_generation - energy.power_consumption
        energy.battery_soc = clamp(
            energy.battery_soc + energy_difference * 0.03 + rng.normal(0, 0.2),
            0.0, 100.0,
        )
        energy.critical_systems_powered = not (
            energy.generator_status != "RUNNING" and energy.battery_soc <= 0.0
        )

        if energy.generator_status == "FAULT":
            energy.generator_health = clamp(energy.generator_health - rng.uniform(0.02, 0.05), 0.0, 100.0)
        else:
            energy.generator_health = clamp(energy.generator_health - rng.uniform(0.001, 0.01), 0.0, 100.0)

        infra.vibration = clamp(
            infra.vibration + rng.uniform(-0.2, 0.2), 0.5, 5.0
        )
        energy.energy = clamp(
            energy.energy + energy_difference * 0.01 + rng.normal(0, 0.5),
            0.0, 1000.0,
        )


        infra.runtime += 1

        for scenario_type in list(s.active_scenarios.keys()):
            s.active_scenarios[scenario_type] -= 1
            if s.active_scenarios[scenario_type] <= 0:
                del s.active_scenarios[scenario_type]
                self._pending_recoveries.append(scenario_type)

        # Logistics
        days_passed = cfg.simulation_time_multiplier / (24.0 * 60.0)

        log.food_stock_kg = max(
            0.0, log.food_stock_kg - log.food_consumption_daily_kg * days_passed
        )
        # Medicine consumption is now steady and deterministic, same
        # pattern as food -- the old random depletion events had no
        # operational cause, so they're removed rather than tuned.
        log.medicine_stock_units = max(
            0.0, log.medicine_stock_units - log.medicine_consumption_daily * days_passed
        )

        # Refrigeration for food/medicine storage depends on station
        # power. If critical systems lose power (Phase 3), refrigeration
        # stops holding its target temperature and drifts toward
        # equipment_temperature instead -- this is what makes expiry
        # risk respond to a real event instead of sitting frozen.
        target_food_temp = -18.0
        target_medicine_temp = 4.0
        if energy.critical_systems_powered:
            log.food_storage_temperature += (target_food_temp - log.food_storage_temperature) * 0.1
            log.medicine_storage_temperature += (target_medicine_temp - log.medicine_storage_temperature) * 0.1
        else:
            log.food_storage_temperature += (infra.equipment_temperature - log.food_storage_temperature) * 0.05
            log.medicine_storage_temperature += (infra.equipment_temperature - log.medicine_storage_temperature) * 0.05
        log.food_storage_temperature = clamp(log.food_storage_temperature, -25.0, 40.0)
        log.medicine_storage_temperature = clamp(log.medicine_storage_temperature, -5.0, 40.0)

        # Bulk generator fuel reserve, separate from energy.fuel_level's
        # short-term gauge. Drains based on how much power is actually
        # being generated -- a real operational driver, not a fixed rate.
                # ~0.3 L diesel per kWh generated is a standard genset
        # approximation -- simplified, but a real, explainable figure
        # rather than an arbitrary constant.
        elapsed_hours = cfg.simulation_time_multiplier / 60.0
        fuel_reserve_consumption = energy.power_generation * elapsed_hours * 0.3
        log.generator_fuel_reserve_l = max(0.0, log.generator_fuel_reserve_l - fuel_reserve_consumption)

        # Network / comms
        if cfg.network_mode == "SLOW":
            infra.network_status = "SLOW"
            infra.network_bandwidth = round(rng.uniform(5.5, 9.5), 1)
            infra.network_latency = rng.integers(250, 450)
            infra.packet_loss = round(rng.uniform(3.0, 8.0), 1)
            infra.signal_strength = rng.integers(45, 65)
        else:
            infra.network_status = "NORMAL"
            infra.network_bandwidth = round(rng.uniform(75.0, 92.0), 1)
            infra.network_latency = rng.integers(50, 80)
            infra.packet_loss = round(rng.uniform(0.2, 1.2), 1)
            infra.signal_strength = rng.integers(88, 98)

        # Advance simulated clock
        s.timestamp += timedelta(minutes=cfg.simulation_time_multiplier)

        return s

    def _apply_scenario_effects(self) -> None:
        """Overrides specific fields every tick a scenario is active.
        Environmental scenarios need no explicit recovery -- the next
        real/synthetic environment reading naturally overwrites the
        forced value once the scenario is removed. GENERATOR_FAILURE
        and COMMUNICATION_FAILURE override fields nothing else
        refreshes, so they get explicit recovery in _end_scenario_effects."""
        s = self.state
        for scenario_type in s.active_scenarios:
            if scenario_type == "EXTREME_COLD":
                s.environment.temperature = -58.0
            elif scenario_type == "EXTREME_WIND":
                s.environment.wind_speed = 140.0
            elif scenario_type == "PRESSURE_DROP":
                s.environment.air_pressure = 900.0
            elif scenario_type == "HUMIDITY_ANOMALY":
                s.environment.humidity = 98.0
            elif scenario_type == "GENERATOR_FAILURE":
                s.energy.generator_status = "STOPPED"
            elif scenario_type == "COMMUNICATION_FAILURE":
                s.infrastructure.communication_equipment_health = 5.0
                s.infrastructure.communication_equipment_status = "OFFLINE"

    def _end_scenario_effects(self, scenario_type: str) -> None:
        """Explicit recovery for scenarios that override fields nothing
        else naturally refreshes. No-op for environmental scenarios."""
        s = self.state
        if scenario_type == "GENERATOR_FAILURE":
            s.energy.generator_status = "RUNNING"
        elif scenario_type == "COMMUNICATION_FAILURE":
            s.infrastructure.communication_equipment_health = 95.0
            s.infrastructure.communication_equipment_status = "ONLINE"

    def start_scenario(self, scenario_type: str, duration_ticks: int = 30) -> None:
        if scenario_type not in SCENARIO_TYPES:
            raise ValueError(f"Unknown scenario_type '{scenario_type}'. Known: {SCENARIO_TYPES}")
        if duration_ticks <= 0:
            raise ValueError("duration_ticks must be a positive integer")
        self.state.active_scenarios[scenario_type] = duration_ticks

    def stop_scenario(self, scenario_type: str) -> None:
        if scenario_type in self.state.active_scenarios:
            del self.state.active_scenarios[scenario_type]
            self._end_scenario_effects(scenario_type)

    def stop_all_scenarios(self) -> None:
        for scenario_type in list(self.state.active_scenarios.keys()):
            self.stop_scenario(scenario_type)

    def get_active_scenarios(self) -> dict:
        return dict(self.state.active_scenarios)