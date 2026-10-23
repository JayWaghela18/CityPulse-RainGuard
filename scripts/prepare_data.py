#!/usr/bin/env python3
"""
CityPulse RainGuard — data preparation pipeline.

Inputs (raw files in scripts/_raw/, downloaded from public sources; see README):
  1. flood_spots_rasta.json      — Rasta Radar flood-spot inventory (MIT), GitHub
  2. mumbai_rain_2015_23.xlsx    — 15-min automatic rain-gauge readings for the
                                   Mumbai region, 2015–2023 (GitHub, omkar-nitsure)
  3. ../public/data/bmc_wards.geojson        — DataMeet BMC ward boundaries
  4. ../public/data/mumbai_rainfall_imd_monthly.csv — IMD monthly rainfall 1901–2021
                                                    (grid 72.75E, 19.00N, via OpenCity)

Outputs (public/data/, consumed by the web app):
  - hotspots.json           flood-spot inventory with ward assigned by point-in-polygon
  - rainfall_daily.csv      city-scale daily rainfall (mm) 2015–2023 + station counts
  - rainfall_station_summary.json per-gauge period stats (for station comparison)
  - data_report.json        validation / coverage statistics shown in the app

Run:  python scripts/prepare_data.py
"""
from __future__ import annotations

import csv
import json
import math
import os
import statistics
from collections import defaultdict
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "scripts", "_raw")
OUT = os.path.join(ROOT, "public", "data")

MIN_STATIONS_PER_DAY = 5   # a city daily value needs at least this many gauges
START_DATE = "2015-06-01"


# ----------------------------------------------------------------------------- helpers
def load_wards():
    with open(os.path.join(OUT, "bmc_wards.geojson"), encoding="utf-8") as f:
        gj = json.load(f)
    wards = []
    for feat in gj["features"]:
        name = feat["properties"].get("name")
        geom = feat["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = []
        for poly in polys:
            outer = poly[0]
            rings.append([(p[0], p[1]) for p in outer])
        wards.append({"name": name, "rings": rings})
    return gj, wards


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-30) + xi):
            inside = not inside
        j = i
    return inside


def point_on_ring_edge(x, y, ring, eps=1e-9):
    """True when a coordinate falls on (or numerically on) a ward boundary.
    Boundary points are assigned to the ward rather than dropped, so coastal
    and boundary locations do not silently lose their ward."""
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i - 1]
        x2, y2 = ring[i]
        if abs(x2 - x1) < eps and abs(y2 - y1) < eps:
            continue
        cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if abs(cross) > eps:
            continue
        if (
            min(x1, x2) - eps <= x <= max(x1, x2) + eps
            and min(y1, y2) - eps <= y <= max(y1, y2) + eps
        ):
            return True
    return False


def ward_for(lon, lat, wards):
    for w in wards:
        for ring in w["rings"]:
            if point_in_ring(lon, lat, ring) or point_on_ring_edge(lon, lat, ring):
                return w["name"]
    return None


# ----------------------------------------------------------------------------- 1. hotspots
def build_hotspots(wards):
    with open(os.path.join(RAW, "flood_spots_rasta.json"), encoding="utf-8") as f:
        spots = json.load(f)

    features = []
    outside = 0
    for s in spots:
        try:
            lat, lon = float(s["lat"]), float(s["lng"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (math.isfinite(lat) and math.isfinite(lon)):
            continue
        if not (18.5 <= lat <= 19.7 and 72.5 <= lon <= 73.4):
            continue
        ward = ward_for(lon, lat, wards)
        if ward is None:
            outside += 1
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "id": s.get("id"),
                "name": s.get("name"),
                "area": s.get("area"),
                "ward": ward,
                "inGmc": ward is not None,
                "severity": s.get("historical_severity"),
                "depthCm": s.get("known_depth_cm"),
                "sourceNote": s.get("source_note"),
                "description": s.get("description"),
                "routeTags": s.get("route_tags") or [],
            },
        })

    fc = {"type": "FeatureCollection", "features": features}
    with open(os.path.join(OUT, "hotspots.json"), "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    return fc, outside


# ----------------------------------------------------------------------------- 2. rainfall
def build_rainfall():
    try:
        import openpyxl
    except ImportError:
        raise SystemExit("openpyxl required: pip install openpyxl")

    wb = openpyxl.load_workbook(os.path.join(RAW, "mumbai_rain_2015_23.xlsx"), read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    stations = [str(h) for h in header[1:] if h is not None]

    daily_sum = defaultdict(lambda: defaultdict(float))   # date -> station -> mm
    daily_count = defaultdict(lambda: defaultdict(int))   # date -> station -> obs count
    station_totals = defaultdict(float)
    station_days = defaultdict(set)
    bad_rows = 0
    gauge_observations = 0
    first_dt = last_dt = None
    n_rows = 0

    for row in rows:
        if row is None or row[0] is None:
            continue
        dt = row[0]
        if not isinstance(dt, datetime):
            bad_rows += 1
            continue
        n_rows += 1
        if first_dt is None:
            first_dt = dt
        last_dt = dt
        date = dt.strftime("%Y-%m-%d")
        for i, st in enumerate(stations):
            v = row[i + 1]
            if v is None:
                continue
            try:
                v = float(v)
            except (TypeError, ValueError):
                continue
            if math.isnan(v) or v < 0:
                continue
            daily_sum[date][st] += v
            daily_count[date][st] += 1
            station_totals[st] += v
            station_days[st].add(date)
            gauge_observations += 1

    # fill small gaps: a gauge day with < 60 obs (of 96) is still used but flagged
    out_rows = []
    coverage = []
    for date in sorted(daily_sum.keys()):
        per_station = daily_sum[date]
        counts = daily_count[date]
        valid = [v for st, v in per_station.items() if counts[st] >= 48]  # >=12h of data
        n_valid = len(valid)
        if n_valid >= MIN_STATIONS_PER_DAY:
            city = round(statistics.mean(valid), 1)
        else:
            city = ""
        out_rows.append([date, city, n_valid, len(per_station)])
        coverage.append(n_valid)

    with open(os.path.join(OUT, "rainfall_daily.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "city_mm", "stations_used", "stations_reporting"])
        w.writerows(out_rows)

    # station summary
    st_summary = []
    for st in stations:
        days = sorted(station_days.get(st, set()))
        st_summary.append({
            "station": st,
            "periodStart": days[0] if days else None,
            "periodEnd": days[-1] if days else None,
            "days": len(days),
            "totalMm": round(station_totals.get(st, 0.0), 0),
        })
    st_summary.sort(key=lambda x: -x["totalMm"])
    with open(os.path.join(OUT, "station_summary.json"), "w", encoding="utf-8") as f:
        json.dump(st_summary, f, ensure_ascii=False, indent=1)

    # The file records the monsoon window (1 Jun – 30 Sep) only; verify completeness
    # inside that window and count seasons.
    dates = sorted(r[0] for r in out_rows)
    seasons = sorted({d[:4] for d in dates})
    have = {r[0] for r in out_rows if r[1] != ""}
    expected = 0
    missing_dates = []
    for y in seasons:
        d = datetime.strptime(f"{y}-06-01", "%Y-%m-%d").date()
        while d.month <= 9:
            expected += 1
            ds = d.isoformat()
            if ds not in have:
                missing_dates.append(ds)
            d += timedelta(days=1)

    daily_values = [r[1] for r in out_rows if r[1] != ""]

    return {
        "stations": stations,
        "firstReading": first_dt.isoformat() if first_dt else None,
        "lastReading": last_dt.isoformat() if last_dt else None,
        "readingRows": n_rows,
        "timestampRows": n_rows,
        "gaugeObservations": gauge_observations,
        "dailyMeanMm": round(statistics.mean(daily_values), 1) if daily_values else None,
        "dailyMaxMm": max(daily_values) if daily_values else None,
        "malformedRows": bad_rows,
        "dailyStart": dates[0] if dates else None,
        "dailyEnd": dates[-1] if dates else None,
        "dailyRows": len(out_rows),
        "dailyComplete": len(have),
        "seasons": seasons,
        "expectedDays": expected,
        "missingDays": len(missing_dates),
        "missingDates": missing_dates[:20],
        "window": "1 Jun – 30 Sep (monsoon season) only; Oct–May not recorded",
        "minStationsPerDay": MIN_STATIONS_PER_DAY,
        "medianStationsPerDay": int(statistics.median(coverage)) if coverage else 0,
    }


# ----------------------------------------------------------------------------- 3. IMD monthly
def summarize_imd():
    path = os.path.join(OUT, "mumbai_rainfall_imd_monthly.csv")
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    totals = [float(r["Total"]) for r in rows if r.get("Total") not in (None, "")]
    jjas = [float(r["June"]) + float(r["July"]) + float(r["Aug"]) + float(r["Sept"]) for r in rows]
    return {
        "rows": len(rows),
        "startYear": int(rows[0]["Year"]),
        "endYear": int(rows[-1]["Year"]),
        "meanAnnualMm": round(statistics.mean(totals), 0),
        "medianAnnualMm": round(statistics.median(totals), 0),
        "meanMonsoonMm": round(statistics.mean(jjas), 0),
        "maxYear": max(rows, key=lambda r: float(r["Total"]))["Year"],
        "maxYearMm": round(max(totals), 0),
        "minYear": min(rows, key=lambda r: float(r["Total"]))["Year"],
        "minYearMm": round(min(totals), 0),
    }


# ----------------------------------------------------------------------------- main
def main():
    os.makedirs(OUT, exist_ok=True)
    wards_gj, wards = load_wards()
    fc, outside = build_hotspots(wards)
    rain = build_rainfall()
    imd = summarize_imd()

    in_gmc = [f for f in fc["features"] if f["properties"]["inGmc"]]
    sev_counts = defaultdict(int)
    for f in in_gmc:
        sev_counts[f["properties"]["severity"]] += 1

    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sources": {
            "wards": "DataMeet Municipal_Spatial_Data — Mumbai/BMC_Wards.geojson (CC BY-SA 2.5 India)",
            "hotspots": "Rasta Radar flood_spot inventory (MIT), GitHub",
            "rainfallRecent": "15-min automatic rain-gauge readings, Mumbai region 2015–2023 (GitHub, omkar-nitsure/Mumbai_RainFall_Forecasting)",
            "rainfallHistoric": "IMD monthly rainfall grid 72.75E/19.00N 1901–2021 via OpenCity (public domain)",
        },
        "wards": len(wards_gj["features"]),
        "hotspots": {
            "total": len(fc["features"]),
            "insideGreaterMumbai": len(in_gmc),
            "outsideGreaterMumbai": outside,
            "wardCoverage": len(sorted({f["properties"]["ward"] for f in in_gmc})),
            "severityHistogram": {str(k): sev_counts[k] for k in sorted(k for k in sev_counts if k)},
            "firstObsNote": "Inventory compiled from published civic flood mapping; not dated incident records.",
        },
        "rainfall": rain,
        "imdMonthly": imd,
    }
    with open(os.path.join(OUT, "data_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
