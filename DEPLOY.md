# Deployment

CityPulse RainGuard is a static site. The production build writes everything
the browser needs into `dist/`, so you can host it anywhere that serves static
files.

## What to deploy

Deploy the contents of `dist/` after a clean build:

```bash
npm install
npm run build
```

That runs `tsc -b` first, then `vite build`. If either step fails, do not
deploy — the output is not guaranteed to be consistent.

The build produces:

- `dist/index.html`
- `dist/assets/*.js`
- `dist/assets/*.css`
- `dist/favicon.svg`

The app also needs the public data files at runtime. Those live in
`public/data/` during development. For a static host, either:

1. copy `public/data/` into the deployed site root next to `index.html`, or
2. serve the prepared data from the same origin/path the app expects.

The app loads data from `data/<file>` relative to the page by default.

## Required public data files

At runtime the app reads:

- `data/hotspots.json`
- `data/bmc_wards.geojson`
- `data/rainfall_daily.csv`
- `data/mumbai_rainfall_imd_monthly.csv`
- `data/station_summary.json`
- `data/data_report.json`

If any of those are missing, the corresponding views degrade into honest empty
states instead of showing fabricated data.

## Environment variables

None are required for the public version of this app. Vite sets
`import.meta.env.BASE_URL` automatically. If you deploy under a subpath, set
the public base path for the build so asset and data URLs resolve correctly.

## Good deployment targets

This is a static frontend, so the easiest reliable targets are static hosting
providers or any server that can serve the `dist/` folder and the `data/`
folder from the same origin. Pick a host that preserves file paths and does not
rewrite asset URLs.

It does **not** include a backend, server-side rendering runtime, or scheduled
data refresh, so there is nothing to run continuously on the server side.

## What not to do

- Do not deploy uncommitted or hand-edited files in `public/data/`. Regenerate
  them with `scripts/prepare_data.py` if you changed the raw inputs.
- Do not add environment secrets to the repo to make deployment work. There is
  no backend here that needs them.
- Do not describe this as a live flood-warning system after deploying it. The
  app itself states clearly that it is a historical, evidence-led product.

## If you want it online quickly

The simplest path is:

1. run `npm run build`
2. upload `dist/` and `public/data/` to a static host
3. open the deployed URL and confirm every page loads
4. confirm the map, filters, charts and risk list all render with the
   prepared datasets

If any page shows an empty state that should be populated, check that the data
files landed at the expected `data/` path on the deployed host.

## Local preview of the production build

```bash
npm run preview
```

That serves the built output locally so you can sanity-check the production
bundle before you publish it anywhere.
