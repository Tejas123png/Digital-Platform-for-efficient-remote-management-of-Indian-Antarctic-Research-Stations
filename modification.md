# PolarSync — Antarctic Station Simulator, Explained Simply

**Smart India Hackathon 2026 — Problem Statement 26060**
*"Digital Platform for efficient remote management of Indian Antarctic Research Stations"*

This document explains, in plain language, what PolarSync's simulator actually does, what changed from the original version, and how to see it working for yourself. No coding background required.

---

## 1. What problem are we even solving?

India runs two research stations in Antarctica — **Maitri** and **Bharati**. They're thousands of kilometers from anywhere, cut off for months by weather, and everything that keeps people alive there (heating, power, food, medicine, communication) has to be monitored and managed remotely.

The government wants a **"Digital Twin"** — basically, a live, realistic computer model of each station that mirrors what's actually happening there, so people back in India can monitor conditions, predict problems, and make decisions without physically being there.

**PolarSync is our attempt at building that model.** This document is about the "engine" behind it — the simulator that generates realistic station data.

---

## 2. The single most important idea in this whole project

> **A good station simulator should NOT just generate random numbers. It should behave like a real station, where one thing genuinely causes another.**

Example of what we do NOT want:
> "Temperature is a random number. Fuel level is a random number. Power usage is a random number."

Example of what we DO want:
> "It gets colder outside → the heater has to work harder → that uses more electricity → the generator has to work harder → that burns more fuel → the fuel tank goes down faster."

That second version is what we spent most of this project building — and proving, step by step, with actual test results, that it really works that way and isn't just a nice-sounding claim.

---

## 3. Before vs. After — what actually changed

| Area | BEFORE | AFTER |
|---|---|---|
| **Stations** | Only Maitri existed. Bharati was a greyed-out "Coming soon" button — nothing behind it. | Both Maitri and Bharati are fully working, independent stations. |
| **Weather data** | A real 2016 weather dataset for Maitri existed, but it was only used to draw a chart on the screen — it never actually affected the simulation. | Both stations' weather is **real historical sensor data** from NCPOR (India's official Antarctic data agency) — Maitri from 2016, Bharati from 2026 — and it genuinely drives what happens inside the station. |
| **Heating & power** | Temperature, heating, and power use were three separate random numbers with no connection to each other. | Cold weather → heater works harder → power use rises → generator works harder → fuel drops. All connected, all provable (see Section 5). |
| **Generator failure** | There was no way to actually "fail" the generator and see what happens. | You can trigger a real generator failure on demand. Power drops, the battery takes over, and if the battery runs out, the system correctly flags that critical equipment has lost power. Everything recovers on its own once the generator restarts — nothing gets permanently stuck. |
| **Random "anomalies"** | The old system randomly decided, about 5% of the time on every tick, whether something bad would happen — a dice roll, no way to control it. | Every emergency scenario is triggered **on command**, with a known duration, so a demo can reliably show "here's a generator failure" instead of hoping one happens to occur while judges are watching. |
| **Medicine status bug** | A field called "medicine status" was **hardcoded to always show "CRITICAL,"** even when medicine supplies were completely full. This bug existed since before we started and nobody had caught it. | Fixed. Medicine status now genuinely reflects how much medicine is left and how fast it's being used. |
| **Backup heater / water treatment / comms equipment** | These fields existed but did nothing — "pump status" was hardcoded to always say "working," no matter what. | These are now real subsystems with real health values. A backup heater automatically kicks in during extreme cold. Water pump status is genuinely calculated from equipment health, not hardcoded. |
| **Wind, air pressure, humidity** | These were tracked as numbers but had zero effect on anything else. | Wind now causes wind chill (extra heat loss). Low air pressure now reduces how much power the generator can produce (a real diesel-engine effect). High humidity now speeds up equipment wear and corrosion. |
| **Fuel accounting** | There was a "fuel" number, but it wasn't based on any real-world rate — just an arbitrary number going down. | Fuel now drains based on a standard real-world diesel generator consumption rate (about 0.3 liters of fuel per kilowatt-hour generated) — a number you could look up and check yourself. |
| **API / testing tools** | You could only get data by fetching one link; no way to control anything (no scenario testing, no stop/start). | A full set of documented, clickable API commands via **Swagger** (explained in Section 7) — start/stop the simulator, trigger any emergency, check any station's status, all from a web page with buttons. |

---

## 4. How the simulation actually flows (the "digital twin" logic)

Think of it like a chain of dominoes. Each one only falls because the one before it pushed it.

```
REAL WEATHER DATA (from NCPOR satellites/sensors)
        │
        ▼
Temperature, wind, air pressure, humidity change
        │
        ▼
Heater has to work harder or less hard to keep the station warm
        │
        ▼
Electricity usage goes up or down
        │
        ▼
Generator has to work harder or less hard
        │
        ▼
Fuel gets used up faster or slower
        │
        ▼
Battery charges or discharges depending on whether the generator
is making more or less power than the station is using
        │
        ▼
If something breaks (generator, comms, water system), the effects
ripple forward: less power → food/medicine refrigeration may fail →
expiry risk goes up → resupply risk goes up
```

Every arrow in that chain is real code that we tested by actually running it and checking the numbers moved the way they should — not just written and assumed to work.

---

## 5. Proof it's not just random numbers — the actual science behind it

This is the part your friends will probably be most skeptical of, so here's the receipts.

### 5.1 — Wind chill (real meteorology)
When wind speed goes up, the station loses heat faster than the raw temperature alone would suggest — this is the same "wind chill" effect used in real weather forecasts. We built this in as an actual formula, and tested it head-to-head:

- Calm wind, -10°C: heater averaged **41.5** (arbitrary power units)
- Extreme wind (140 km/h), -10°C: heater averaged **44.8**

Same temperature, different wind → different heating demand. That's the wind chill effect actually working, not decoration.

### 5.2 — Diesel generators lose power at high altitude / low air pressure (real engineering)
A diesel generator burns air along with fuel. Less air pressure = less oxygen = less power for the same effort — this is a well-known, real phenomenon in engine design. We tested it directly:

- Normal air pressure (1013 hPa): generator produced **72.53** kW for a given load
- Low pressure (900 hPa, a "pressure drop" emergency): the *same* load only produced **66.08** kW

Same generator setting, less usable power at lower pressure — a real physical effect, not a coin flip.

### 5.3 — Realistic fuel consumption rate
Instead of inventing a random "fuel drains at X% per hour" number, we used a standard rule of thumb used in real-world generator sizing: **about 0.3 liters of diesel per kilowatt-hour of electricity generated.** That's a number anyone can look up and sanity-check — it's not something we made up to look impressive.

### 5.4 — A heater has a maximum capacity, and extreme cold can genuinely overwhelm it
We gave the heater a maximum output (60 kW). At everyday cold temperatures, it easily keeps the station at a comfortable ~32°C. But at genuinely extreme cold (-55°C), we proved the heater cannot keep up — indoor temperature actually starts dropping, tick by tick, exactly like a real heating system that's been pushed past its limit:

- Tick 0: indoor temp 34.0°C
- Tick 25: indoor temp down to 21.7°C, heater pinned at its 60 kW maximum

That's not a random dip — it's the heater running flat-out and still losing the battle against the cold, which is exactly what would happen in real life.

### 5.5 — Batteries recharge, but only when there's power to spare
When the generator fails and the battery has to cover the whole station's power needs by itself, we tested that the battery genuinely drains — smoothly, tick by tick, not in a random jump. Then, once the generator comes back online, we proved the system deliberately produces a little *extra* power specifically to recharge the battery back up — the same way a real backup power system prioritizes recharging once main power is restored.

---

## 6. The six emergency scenarios you can trigger

All six are triggered on command (not random), run for a set duration, and automatically undo themselves afterward — nothing gets stuck.

| Scenario | What it does | Real effect it causes |
|---|---|---|
| **EXTREME_COLD** | Forces outside temperature to -58°C | Heater struggles, backup heater kicks in, power use spikes, fuel drains faster |
| **EXTREME_WIND** | Forces very high wind speed | Wind chill increases heat loss; equipment wears faster from mechanical stress |
| **PRESSURE_DROP** | Forces very low air pressure | Generator produces less power for the same effort (real diesel-engine physics) |
| **HUMIDITY_ANOMALY** | Forces very high humidity | Water treatment and communication equipment wear out faster (corrosion) |
| **GENERATOR_FAILURE** | Stops the generator completely | Power drops to zero, battery takes over, critical systems can lose power if the battery empties, everything self-recovers once it ends |
| **COMMUNICATION_FAILURE** | Knocks out communication equipment | Comms status goes offline, then automatically comes back online when the scenario ends |

---

## 7. How to actually see this working — Swagger, step by step

**Swagger** is just a web page with buttons for every command the simulator understands. You don't need to know how to code to use it.

### Step 1 — Start the simulator
On the computer running the project, open a terminal and run:
```
python data_simulator.py
```

### Step 2 — Open the control panel in a browser
Go to:
```
http://127.0.0.1:5000/apidocs
```
You'll see a list of everything the simulator can do, grouped into sections.

### Step 3 — Try these, in this order, to see it come alive

1. **Check it's alive** — open `GET /api/health`, click "Try it out," then "Execute." You should get back `{"status": "ok"}`.

2. **See a live station** — open `GET /api/data`, type `MAITRI` (or `BHARATI`) into the station box, and click Execute. You'll see a big block of numbers — that's the entire current state of the station: temperature, power, fuel, food stock, everything.

3. **Trigger an emergency** — open `POST /scenario/start`. In the box, type:
   ```json
   {
     "station": "MAITRI",
     "type": "GENERATOR_FAILURE",
     "duration_ticks": 15
   }
   ```
   Click Execute. Now go back to `GET /api/data` for MAITRI — you'll see `generator_status` now says `"STOPPED"` and the battery number will be dropping if you check again a few seconds later.

4. **See the full picture at once** — open `GET /demo/snapshot`, type in a station, click Execute. This gives you everything — environment, energy, infrastructure, logistics, and any active alerts — in one organized view. This is the best one to show your friends, since it's grouped and easy to read.

5. **Watch it recover** — wait about 15-20 seconds after step 3, then check `GET /api/data` again. `generator_status` should say `"RUNNING"` again on its own — nobody had to manually fix it.

### How to read the numbers you'll see

| Field | What it means in plain terms |
|---|---|
| `temperature`, `wind_speed`, `humidity` | The actual outside weather at the station right now |
| `environment_source_type` | Tells you if that weather is **real recorded data** (`NCPOR_OFFICIAL_DATASET`) — both stations currently use real data |
| `power_generation` vs `power_consumption` | How much electricity is being made vs. being used — if consumption is higher, the battery drains; if generation is higher, the battery charges |
| `fuel_level` / `generator_fuel_reserve_l` | How much fuel is left — one is a short-term gauge, one is the big long-term backup tank |
| `battery_soc` | Battery charge percentage |
| `critical_systems_powered` | `true` or `false` — whether life-support-critical equipment currently has power at all |
| `medicine_status` / `food_status` | Whether supplies are in good shape, running low, or critical |
| `resupply_risk` | An overall "how worried should we be about running out of something" indicator |
| `active_scenarios` | Which emergencies (if any) are currently being simulated |

---

## 8. Honest limitations — things we know aren't finished yet

We're being upfront about this rather than pretending it's 100% complete:

- **The simulator itself is done and tested**, but it isn't yet connected to the website's visual dashboard — right now you see it through Swagger's technical interface, not a polished dashboard screen.
- **Only two of our four uploaded real datasets are being used** (Maitri 2016 and Bharati 2026). Two others (Maitri 2010, Bharati 2023) had data quality issues — wrong wind direction format, missing humidity — that we deliberately chose not to rush into fixing.
- **The AI assistant** (which explains alerts in plain language) exists and works, but it only *explains* problems that the simulator's rules have already detected — it never decides on its own whether something counts as a problem. That's intentional and considered good practice, not a shortcut.
- Bharati's real weather dataset only covers about 2.5 months (not a full year like Maitri's), so during a very long demo session it will start repeating that same weather window.

---

## 9. In one sentence, for your friends

**We took a station simulator that was mostly random numbers wearing a "digital twin" costume, and turned it into something where every major number is either real recorded Antarctic weather data or a value calculated using genuine physics and engineering formulas — and we proved it, step by step, with actual test results, not just claims.**