# Contributing

Thanks for taking a look. This is a hackathon-scale project, so the bar for
contributions is intentionally pragmatic: clear intent, reproducible data, and
no regressions on the public numbers.

## Getting started

```bash
cd citypulse-rainguard
npm install
npm run dev
```

If you touch any dataset or the preparation script:

```bash
pip install -r requirements.txt
python scripts/prepare_data.py
```

Then verify everything still passes:

```bash
npm run build
npx oxlint
python scripts/verify_data.py
```

## What this repo is / is not

- **It is** a static frontend backed by public prepared datasets and a Python
  pipeline that regenerates those datasets from raw public downloads.
- **It is not** a live flood service, a predictive model, or a backend. The app
  never claims current road conditions; it says so in the UI and the README.

## Branch and commit style

- Branch from `main` and open a PR back to `main`.
- Prefer small, reviewable PRs: one concern per PR where possible.
- Commit messages should explain **why**, not just **what**.
- If a PR changes a statistic shown in the app, include the verification output
  from `python scripts/verify_data.py` in the PR description.

## How to propose changes

1. Open an issue first for anything larger than a typo or copy fix, especially
   if it affects a displayed number, the methodology, or a source attribution.
2. Keep data changes auditable. If you replace a raw input, leave the previous
   raw file in `scripts/_raw/` unless the project maintainer asks otherwise, and
   explain the source and date of the new file.
3. Do not patch numbers by hand in `public/data/`. Regenerate them with the
   pipeline so the result stays reproducible.

## Data-related changes

- Ward geometry: `public/data/bmc_wards.geojson`
- Flood-spot inventory: `scripts/_raw/flood_spots_rasta.json`
- Recent rain-gauge workbook: `scripts/_raw/mumbai_rain_2015_23.xlsx`
- IMD monthly rainfall: `public/data/mumbai_rainfall_imd_monthly.csv`
- Prepared outputs: `public/data/hotspots.json`, `rainfall_daily.csv`,
  `station_summary.json`, `data_report.json`

After changing any raw input or the preparation script, rerun the pipeline and
the verification script. The verification script is the fastest way to confirm
you did not silently change a public number.

## Code conventions

- TypeScript strict mode; the build runs `tsc -b` before bundling.
- Use the existing components and design tokens in `src/`. Do not introduce a
  new color, spacing scale, or typography scale without checking the rest of the
  app first.
- Map code lives in `src/components/map/`, shared UI in
  `src/components/ui/`, charts in `src/components/charts/`, analytics in
  `src/lib/analytics.ts`, and scoring in `src/lib/scoring.ts`.
- Keep the map the visual centerpiece on the Explore page; do not make
  interactive controls harder to reach on mobile.

## Things we explicitly avoid

- Inventing numbers, dates, incident histories, or accuracy claims.
- Presenting reported source attributes as independently verified measurements.
- Adding a “safe” label for low-scoring locations.
- Hardcoding a statistic that the app already derives from data.

## Questions

If you are unsure whether something belongs in this project, ask in an issue
before investing time in it. For reproducibility questions, start with
`scripts/prepare_data.py`, `scripts/verify_data.py`, and `README.md`.
