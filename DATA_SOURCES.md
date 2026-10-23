# Data sources

This document lists every external dataset the app uses, how it is obtained,
how it is processed, and what its limits are. It is meant to be the detailed
appendix to the source table in `README.md`.

Every dataset used here is public before it reaches this project. The app never
subscribes to a paid feed, never calls an authenticated API at runtime, and
never stores anything server-side.

---

## 1. BMC municipal ward boundaries

- **What it is:** the 24 municipal wards of Greater Mumbai as polygon
  boundaries.
- **Source:** the DataMeet *Municipal_Spatial_Data* repository, Mumbai folder.
  - Repository: `github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai`
- **Files used:** `public/data/bmc_wards.geojson`, a GeoJSON FeatureCollection
  whose features have `properties.name`.
- **Spatial coverage:** individual BMC ward polygons.
- **Date coverage:** a boundary layer, not a time series. Wards change over
  time; this product uses the geometry that exists in the source at preparation
  time.
- **Processing:**
  - only the outer ring of each MultiPolygon feature is kept
  - each feature must have a `name`; ward labels throughout the app come from
    that property
  - the same file is used both for map boundaries and for
    point-in-polygon ward assignment
- **Attribution:** ward geometry © DataMeet contributors.
- **Licence relied on:** CC BY-SA 2.5 India, as noted in the source folder.
- **Limitations:**
  - wards are administrative boundaries, not catchment areas, traffic zones, or
    drainage zones
  - ward-level statistics in this product are descriptive patterns over the
    inventory, not hydrological measurements
  - if ward boundaries are later updated, every ward label and every ward
    statistic changes automatically after rerunning the preparation script

---

## 2. Flood-spot inventory

- **What it is:** a curated list of flood-prone road locations compiled by a
  public civic project from published municipal flood mapping.
- **Source:** the Rasta Radar repository.
  - Repository: `github.com/M0izz/Rasta-Radar`
- **Files used:**
  - raw input: `scripts/_raw/flood_spots_rasta.json`
  - prepared output: `public/data/hotspots.json`
- **Spatial coverage:** 90 regional records, of which 47 fall inside Greater
  Mumbai BMC wards and 22 of 24 wards are represented.
- **Fields expected in the raw file:**
  - `id`, `name`, `area`, `lat`, `lng`
  - `historical_severity`
  - `known_depth_cm`
  - `source_note`
  - `description`
  - `route_tags`
- **Processing:**
  - coordinates are parsed as floats and validated to be finite
  - locations outside a plausible Mumbai-region bounding box are dropped before
    any analysis
  - each remaining location is assigned to a ward with a ray-casting
    point-in-polygon test against the outer ward rings
  - locations outside every ward are kept but labelled *regional context*, and
    excluded from city statistics
  - the ward assignment, `inGmc` flag, and location geometry are written into
    the prepared GeoJSON
- **What the app treats these fields as:**
  - **Reported, not measured.** Severity, depth, and locations come from the
    source inventory; this project has not independently field-verified them.
  - Severity is displayed on a 1–5 scale across the map, charts, legend, detail
    panel, and risk list.
  - Reported depth is displayed in centimetres where present.
  - The source note is shown verbatim on the detail panel when present.
- **Attribution:** inventory from Rasta Radar.
- **Licence relied on:** MIT, as stated by the repository.
- **Validation this dataset supports:** internal consistency checks, geographic
  integrity checks, ward clustering, severity distribution.
- **Validation this dataset does NOT support:** dated incident frequency, flood
  timing, causal claims, or predictive accuracy.
- **Limitations:**
  - presence in the inventory means the location is documented as flood-prone;
    absence means nothing about safety
  - severity/depth are reported values without attached dates
  - coverage is uneven across wards
  - a location outside BMC wards is shown as regional context only and is never
    counted in city statistics

---

## 3. Automatic rain-gauge readings, 15-minute

- **What it is:** 15-minute automatic rain-gauge readings for the Mumbai region.
- **Source:** the Mumbai RainFall Forecasting dataset.
  - Repository: `github.com/omkar-nitsure/Mumbai_RainFall_Forecasting`
- **Files used:**
  - raw input: `scripts/_raw/mumbai_rain_2015_23.xlsx`
  - prepared outputs:
    - `public/data/rainfall_daily.csv`
    - `public/data/station_summary.json`
    - `data_report.json` entries under `rainfall`
- **Date coverage:** 1 June – 30 September each season, 2015–2022.
- **Station coverage:** 37 gauges listed by name.
- **Reading coverage:**
  - 93,696 timestamp rows parsed
  - 3,466,715 gauge observations across those rows
  - 976 monsoon-window days complete in the derived city series
- **Processing:**
  - each timestamped row is parsed from the workbook
  - each non-null 15-minute value is summed per gauge-day
  - a gauge-day is used only if it has at least 48 of 96 readings, equivalent
    to about 12 hours of observations
  - the city value for a day is the mean of valid gauge-days, but only when at
    least 5 gauges reported for that day
  - otherwise the day is left empty; it is never interpolated and never
    zero-filled
  - seasons are treated as 122 complete monsoon-window days
- **What the app uses this for:**
  - city-scale daily rainfall
  - season totals, daily means, extremes and heavy-day counts
  - the seasonal daily chart, the heaviest-day table, and the wettest-gauge
    list
- **Attribution:** rainfall readings from the Mumbai RainFall Forecasting
  dataset.
- **Licence relied on:** the repository licence. If you reuse the data beyond
  this project, confirm reuse with the author.
- **Validation this dataset supports:** completeness, plausibility, seasonal
  variability, heavy-day patterns.
- **Limitations:**
  - the source records the monsoon window only; October–May are not present in
    the source and the app says so rather than assuming dry months
  - rainfall is city-scale; the app does not attribute rainfall to any hotspot
    or ward
  - the source lists station names without coordinates, so rainfall cannot be
    mapped or joined to wards
  - this is a historical record; it does not provide live rainfall
  - before reusing this dataset outside the project, confirm the licence and
    reuse terms with the author

---

## 4. IMD monthly rainfall, grid 72.75°E 19.00°N

- **What it is:** monthly rainfall totals for a single IMD grid cell covering
  Mumbai, used as a long-run climatology.
- **Source:** India Meteorological Department via OpenCity.
  - Dataset page: `data.opencity.in/dataset/mumbai-rainfall-data`
  - IMD grid page referenced in the source metadata:
    `www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html`
- **Files used:** `public/data/mumbai_rainfall_imd_monthly.csv`
- **Date coverage:** 1901–2021, 121 annual records.
- **Spatial coverage:** a single grid cell, not a city average of stations.
- **Processing:**
  - each row is parsed from the CSV
  - `Year` is used as the year key
  - monthly columns are matched against common month-name variants used by the
    source layout
  - `Total` is used as the annual total when present; otherwise it is computed
    as the sum of the monthly values
  - the app derives annual totals, monsoon totals, a monthly climatology across
    all years, the JJAS share of annual rainfall, and the wettest and driest
    years in the series
- **What the app uses this for:**
  - long-run annual rainfall
  - monthly climatology
  - context for how dominant the June–September window is in Mumbai’s rainfall
    cycle
- **Attribution:** rainfall records from India Meteorological Department, accessed
  via OpenCity.
- **Licence relied on:** public domain as described by the OpenCity metadata.
- **Limitations:**
  - this is a single grid cell; it is an areal estimate, not a city average of
    gauges
  - the monthly series ends in 2021, while the recent gauge record ends in
    2022 — the two records are not the same dataset
  - the grid cell is useful for long-run context, not for precise local rainfall
    at any specific location

---

## 5. Dated waterlogging incident log

- **What it is:** a public, verifiable, dated log of road waterlogging
  incidents — the dataset this product would need to support incident-time
  analysis and genuine predictive validation.
- **Status in this project:** **not available in verified public sources.**
- **What was checked:** BMC disaster-management channels and data portals were
  checked for a downloadable dated incident CSV that could be verified at build
  time. None was found.
- **Files used:** none.
- **What this means:** the app does not invent incidents, does not claim
  incident counts, and does not claim predictive accuracy. The absence is stated
  in the UI and in the documentation rather than hidden.
- **If one is obtained later:**
  - add a raw file under `scripts/_raw/`
  - extend `scripts/prepare_data.py` and the analytics layer to compute incident
    frequency
  - update the UI to expose incident-time analysis deliberately, because the
    current app contains none

---

## Source URLs at a glance

- BMC ward boundaries: `github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai`
- Flood-spot inventory: `github.com/M0izz/Rasta-Radar`
- Rain-gauge readings: `github.com/omkar-nitsure/Mumbai_RainFall_Forecasting`
- IMD monthly rainfall: `data.opencity.in/dataset/mumbai-rainfall-data`
- IMD grid reference: `www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html`

---

## Base maps

- Base map tiles: © OpenStreetMap contributors, © Esri, © HERE, © Garmin.
- The app uses Esri’s keyless Canvas tile endpoints for the dark and light
  basemap styles.
- Leaflet renders the map.

---

## Reproducing the prepared files

From the project root:

```bash
pip install -r requirements.txt
python scripts/prepare_data.py
```

The script reads the raw files above, validates coordinates, assigns wards,
aggregates gauge readings, and writes the prepared files plus a machine-readable
coverage report in `public/data/data_report.json`. Inspecting that report is the
fastest way to sanity-check a new dataset before reloading the app.

---

## What changed when this data documentation was written

The README already contained the high-level source table. This file consolidates
the same information into one place with more detail on fields, processing, what
each dataset supports, and what it does not. It does not change any analysis or
any number in the app; it only documents them more completely.
