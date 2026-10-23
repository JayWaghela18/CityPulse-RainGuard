# CityPulse RainGuard

**Mumbai monsoon intelligence — historical waterlogging hotspots, real rainfall records, and an explainable read on where to inspect first.**

CityPulse RainGuard is an evidence-led civic-tech application built for a hackathon. It maps publicly documented flood-prone road locations across Mumbai against BMC ward boundaries and eight completed monsoon seasons of automatic rain-gauge data, then ranks locations for pre-monsoon inspection using a fully published, non-predictive scoring method.

Every number on screen is derived from a public dataset. There are no mock series, no simulated incidents, no fabricated API integrations, and no live-status claims.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm run preview      # serve the production build
```

Requirements: Node 20+, npm. Map tiles require network access (OpenStreetMap contributors / CARTO basemaps). No API keys or paid services are used.

### Regenerate the prepared data (optional)

The app ships with prepared files in `public/data/`. To rebuild them from the raw downloads:

```bash
pip install openpyxl
python scripts/prepare_data.py
```

Raw source files live in `scripts/_raw/`; the script writes `hotspots.json`, `rainfall_daily.csv`, `station_summary.json` and `data_report.json` into `public/data/`, and prints a machine-readable coverage report.

---

## Data sources

| Dataset | Source | Period / coverage | Licence | Used for |
|---|---|---|---|---|
| BMC municipal ward boundaries | [DataMeet Municipal_Spatial_Data](https://github.com/datameet/Municipal_Spatial_Data/tree/master/Mumbai) | 24 BMC wards, polygons | CC BY-SA 2.5 India (folder note) | Ward assignment (point-in-polygon), map boundaries, labels |
| Flood-spot inventory | [Rasta Radar](https://github.com/M0izz/Rasta-Radar) | 90 regional records, 47 inside Greater Mumbai, 22/24 wards | MIT (repository) | Location names, coordinates, reported severity 1–5, reported ponding depth, source notes |
| 15-minute automatic rain-gauge readings | [Mumbai RainFall Forecasting dataset](https://github.com/omkar-nitsure/Mumbai_RainFall_Forecasting) | 1 Jun – 30 Sep, 2015–2022, 37 gauges, 93,696 readings | Repository licence — confirm reuse with the author | City-scale daily rainfall, season totals, extremes, heavy-day counts |
| IMD monthly rainfall | [OpenCity Mumbai rainfall](https://data.opencity.in/dataset/mumbai-rainfall-data) (source: IMD) | 1901–2021, single grid cell 72.75°E 19.00°N | Public domain (metadata) | Long-run climatology and annual variability |
| Dated waterlogging incident log | **Not found in verified public sources** | — | — | Nothing — the absence is stated in the product |

> **Important provenance note.** The inventory is a curated list of flood-prone locations compiled by a public civic project from published municipal flood mapping. It is **not** a dated incident log, and its severity/depth fields are reported values that this project has not independently field-verified. BMC disaster-management and data.gov.in portals exposed no downloadable dated incident CSV that could be verified at build time.

Base map tiles: © OpenStreetMap contributors, © CARTO. Leaflet is the map engine.

---

## What the product shows

- **Overview** — what the product is, four KPIs computed from loaded data, a map-led view of inventoried hotspots, computed findings, and an explicit coverage/freshness table including the missing incident log.
- **Explore Map** — the signature view: search, ward filter, severity filters, geographic scope, season selector for rainfall context, point/density layers, basemap and ward toggles, a legend, and a detail panel with evidence, ward context, rainfall context and provenance.
- **Rainfall & Insights** — daily rainfall for any recorded season against the multi-season mean, the 121-year IMD annual series, monthly climatology, ward-wise severity stacking, reported-depth distribution, heaviest recorded days and wettest gauges.
- **Risk Assessment** — transparent hotspot prioritisation with per-location factor breakdown, priority bands, and an explicit validation-status card.
- **Methodology & Data** — sources and licences, pipeline, cleaning rules, scoring formula, validation performed, what could not be validated, limitations, update and reproduction instructions.

### Data integrity rules enforced in the UI

- No live road status is ever shown or implied.
- Rain-gauge values are city-scale, never attributed to a specific hotspot or ward.
- Missing values render as gaps, never as zero.
- A location without a high priority score is never labelled "safe".
- No predictive accuracy, precision, recall or calibration figure is claimed.
- Locations outside BMC ward polygons are labelled *regional context* and excluded from city statistics.

---

## Methodology (summary)

**Ward assignment.** GeoJSON features are validated, then assigned to wards with a ray-casting point-in-polygon test against outer ward rings. Points outside every ward remain visible but are excluded from city KPIs, ward counts and scoring density.

**Daily rainfall.** 15-minute readings are summed per gauge-day. A gauge-day is used only when it has ≥48 of 96 readings; the city value requires ≥5 reporting gauges, otherwise the day is empty. Seasons are 122 complete days (1 Jun – 30 Sep). The source records the monsoon window only — the app says so instead of assuming dry months.

**Historical hotspots.** The inventory provides names, coordinates and reported severity/depth. The product treats these as reported evidence and displays the source note for each location.

**Prioritisation score** (0–100, explanatory — not a probability):

```
score = 100 × ( 0.50 × severity/5
              + 0.30 × min(depth_cm, 150)/150
              + 0.20 × ward_spots/ward_max )
```

Bands: Priority A ≥ 70, B 55–69, C 40–54, routine watch < 40. Weights and thresholds are documented judgement calls, defined in `src/lib/scoring.ts`.

**Validation performed.** Monsoon-window completeness (976/976 days), median reporting gauges per day (37), inventory internal consistency (Spearman ρ ≈ 0.93 between reported severity and reported depth), and geographic integrity checks (43 records outside BMC wards excluded from city statistics).

**Validation not possible.** No labelled dated incident dataset could be verified, so there is no train/test evaluation and no accuracy claim anywhere in the product.

---

## Known limitations

- The hotspot inventory is uneven (22 of 24 wards) and its coordinates/severity are reported, not independently field-verified.
- Rainfall is city-scale; station names lack coordinates, so rainfall cannot be mapped or joined to wards.
- Only June–September is recorded; pre/post-monsoon waterlogging is not represented.
- No drainage capacity, elevation, tidal or traffic layers are connected — none are claimed.
- Records end 30 Sep 2022 for gauges and 2021 for the IMD monthly series. This is a historical product; for live advisories use official BMC / disaster-management channels.
- Ward-level statistics are descriptive, not hydrological.

---

## Project structure

```
public/data/                 prepared datasets consumed at runtime
  bmc_wards.geojson          24 BMC ward boundaries (DataMeet)
  hotspots.json              inventory + ward assignment (generated)
  rainfall_daily.csv         city-scale daily rainfall 2015–2022 (generated)
  station_summary.json       per-gauge totals (generated)
  mumbai_rainfall_imd_monthly.csv  IMD 1901–2021 (OpenCity)
  data_report.json           coverage/validation report (generated)
scripts/
  prepare_data.py            raw sources -> app datasets + report
  _raw/                      raw public downloads (not required at runtime)
src/
  lib/                       types, loader, analytics, scoring, formatting, routing
  components/
    shell/                   top bar, nav rail, mobile bottom nav
    map/                     Leaflet map, density canvas layer, legend, detail panel
    charts/                  recharts styling primitives
    ui/                      shared primitives (KPI tile, badges, empty states…)
  pages/                     Overview, Explore, Insights, Risk, Methodology
  index.css                  design tokens + shell/map/motion styles
```

### Connecting updated or new data

- **Hotspots:** replace `scripts/_raw/flood_spots_rasta.json` (fields: `id, name, area, lat, lng, historical_severity, known_depth_cm, source_note, description, route_tags`) and re-run the script. Ward assignment, city statistics and the density layer update automatically.
- **Wards:** replace `public/data/bmc_wards.geojson` with any GeoJSON FeatureCollection whose features have `properties.name`; re-run the script to re-join wards.
- **Rainfall:** `public/data/rainfall_daily.csv` accepts `date,city_mm,stations_used,stations_reporting`; `mumbai_rainfall_imd_monthly.csv` accepts the OpenCity IMD column layout (`Year`, month names, `Total`). Charts read whatever is present and show empty states otherwise.
- **Dated incidents (future work):** no such public file could be verified. If one is obtained, extend `scripts/prepare_data.py` and the analytics layer to compute incident frequency; the UI deliberately contains no incident-time charts until that data exists.

---

## Tech stack

React 19 + TypeScript + Vite · Tailwind CSS v4 (custom design tokens) · Leaflet 1.9 with a custom canvas density layer · Recharts · Python + openpyxl for reproducible data preparation.

No backend, no paid APIs, no secrets, no mandatory paid infrastructure. `npm run build` typechecks and bundles; `npx oxlint` passes with no errors; `python scripts/verify_data.py` re-derives the key public numbers and exits 0 on pass.

---

## Attribution

Ward geometry © DataMeet contributors (CC BY-SA 2.5 India). Inventory and rainfall sources linked above. Base maps © OpenStreetMap contributors, © CARTO. Built as a public-interest, evidence-led hackathon project — corrections and better public datasets are welcome.
