"""
environment.py
==============
Environment data sources for the simulation core.

Two implementations of the same interface:
  - ReplayEngine         -> replays REAL historical NCPOR data (Maitri)
  - SyntheticEnvironment -> generates CLEARLY LABELED synthetic data (Bharati,
                            which has no real historical dataset available)

Both expose `.next_reading() -> EnvironmentReading`, so SimulationCore
never needs to know or care which one it's talking to.
"""

import json
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

from simulation_core import SimulationRNG  # reuse the same seedable RNG wrapper


MISSING_SENTINEL = -999

SOURCE_NCPOR = "NCPOR_OFFICIAL_DATASET"
SOURCE_SIMULATED = "SIMULATED_ENVIRONMENTAL"

QUALITY_VALID = "VALID"
QUALITY_DERIVED = "DERIVED"
QUALITY_MISSING = "MISSING"


@dataclass
class EnvironmentReading:
    temperature: float        # deg C
    air_pressure: float       # hPa
    wind_speed: float
    wind_direction: float     # degrees
    humidity: float           # %
    source_type: str
    quality: str
    source_timestamp: Optional[str] = None
    quality_reason: Optional[str] = None


def load_maitri_dataset(path: str) -> List[Dict[str, Any]]:
    """Loads the raw NCPOR historical JSON as-is. No cleaning or
    interpolation here -- that happens one reading at a time in
    ReplayEngine, so every fill-in stays attributable."""
    with open(path, "r") as f:
        records = json.load(f)
    records = [r for r in records if "obstime" in r]
    records.sort(key=lambda r: r["obstime"])
    return records


def _clean_field(value):
    if value is None or value == MISSING_SENTINEL:
        return None
    return value


class ReplayEngine:
    """
    Replays real historical weather data on the simulation clock.
    Advance speed is derived from simulation_time_multiplier -- the SAME
    time-scale already driving logistics consumption -- so there is only
    one notion of "simulated time speed" in the whole system, regardless
    of how finely the underlying dataset was actually sampled.
    """

    def __init__(
        self,
        records: List[Dict[str, Any]],
        simulation_time_multiplier: int = 1,
        dataset_interval_minutes: int = 60,
    ):
        if not records:
            raise ValueError("ReplayEngine received an empty dataset")
        if dataset_interval_minutes <= 0:
            raise ValueError("dataset_interval_minutes must be positive")
        self.records = records
        self.simulation_time_multiplier = simulation_time_multiplier
        self.dataset_interval_minutes = dataset_interval_minutes
        self._index = 0
        self._last_valid: Dict[str, float] = {}

    def _advance_step(self) -> int:
        # How many dataset rows to skip per tick, given how finely THIS
        # dataset was sampled -- 60 for Maitri's hourly data at the
        # default multiplier, 1 for Bharati's minute-sampled data.
        records_per_tick = self.simulation_time_multiplier / self.dataset_interval_minutes
        return max(1, round(records_per_tick))

    def next_reading(self) -> EnvironmentReading:
        raw = self.records[self._index]
        fields, quality, quality_reason = {}, QUALITY_VALID, None

        for key in ("tempr", "ap", "ws", "wd", "rh"):
            cleaned = _clean_field(raw.get(key))
            if cleaned is None:
                if key in self._last_valid:
                    fields[key] = self._last_valid[key]
                    quality = QUALITY_DERIVED
                    quality_reason = f"{key} missing (sentinel); carried forward last valid value"
                else:
                    fields[key] = 0.0
                    quality = QUALITY_MISSING
                    quality_reason = f"{key} missing with no prior value to carry forward"
            else:
                fields[key] = cleaned
                self._last_valid[key] = cleaned

        reading = EnvironmentReading(
            temperature=fields["tempr"], air_pressure=fields["ap"],
            wind_speed=fields["ws"], wind_direction=fields["wd"], humidity=fields["rh"],
            source_type=SOURCE_NCPOR, quality=quality,
            source_timestamp=raw.get("obstime"), quality_reason=quality_reason,
        )

        self._index = (self._index + self._advance_step()) % len(self.records)
        return reading


class SyntheticEnvironment:
    """
    Clearly-labeled SYNTHETIC environment for stations with no real
    historical dataset (Bharati, currently). Bounded variation around a
    baseline via the same seeded RNG as the rest of the core -- not
    free-floating randomness. Baseline is a reasonable approximation for
    Larsemann Hills (milder, more coastal than Maitri), not measured data.
    """

    def __init__(self, seed: Optional[int] = None):
        self.rng = SimulationRNG(seed)
        self.temperature = -8.0
        self.air_pressure = 975.0
        self.wind_speed = 25.0
        self.wind_direction = 270.0
        self.humidity = 60.0

    def next_reading(self) -> EnvironmentReading:
        self.temperature += self.rng.uniform(-0.4, 0.4)
        self.air_pressure += self.rng.uniform(-0.8, 0.8)
        self.wind_speed = max(0.0, self.wind_speed + self.rng.uniform(-2.0, 2.0))
        self.wind_direction = (self.wind_direction + self.rng.uniform(-3.0, 3.0)) % 360.0
        self.humidity = min(100.0, max(0.0, self.humidity + self.rng.uniform(-1.5, 1.5)))

        return EnvironmentReading(
            temperature=round(self.temperature, 2), air_pressure=round(self.air_pressure, 2),
            wind_speed=round(self.wind_speed, 2), wind_direction=round(self.wind_direction, 1),
            humidity=round(self.humidity, 1),
            source_type=SOURCE_SIMULATED, quality=QUALITY_VALID, source_timestamp=None,
        )