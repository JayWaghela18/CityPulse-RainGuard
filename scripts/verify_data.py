#!/usr/bin/env python3
"""
CityPulse RainGuard — prepared-data verification.

Checks the generated datasets in public/data/ against the documented methodology
and the coverage report. Mirrors the scoring formula in src/lib/scoring.ts so a
pipe/serialization mistake is caught before a demo.

Run: python scripts/verify_data.py
Exit code 0 = all checks passed, 1 = at least one failed check.
"""
from __future__ import annotations

import csv
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")

SEVERITY_WEIGHT = 0.5
DEPTH_WEIGHT = 0.3
DENSITY_WEIGHT = 0.2
DEPTH_CAP_CM = 150
BANDS = {"A": 70, "B": 55, "C": 40}

results: list[tuple[bool, str]] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    results.append((ok, f"{label}{(' — ' + detail) if detail else ''}"))


def load(name: str):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f) if name.endswith((".json", ".geojson")) else list(csv.DictReader(f))


def main() -> int:
    hotspots = load("hotspots.json")["features"]
    wards = load("bmc_wards.geojson")["features"]
    report = load("data_report.json")
    daily = load("rainfall_daily.csv")
    imd = load("mumbai_rainfall_imd_monthly.csv")
    stations = load("station_summary.json")

    props = [f["properties"] for f in hotspots]
    ward_names = {f["properties"]["name"] for f in wards}
    in_city = [p for p in props if p["inGmc"]]

    # --- hotspot integrity ---------------------------------------------------
    coords_ok = all(
        isinstance(f["geometry"]["coordinates"], list)
        and len(f["geometry"]["coordinates"]) == 2
        and all(math.isfinite(v) for v in f["geometry"]["coordinates"])
        for f in hotspots
    )
    check(coords_ok, "Every hotspot has finite [lon, lat] coordinates", f"{len(hotspots)} features")
    check(
        all(p["ward"] in ward_names for p in in_city),
        "Every in-city hotspot is assigned an existing ward",
        f"{len(in_city)} records",
    )
    check(
        all(p["ward"] is None for p in props if not p["inGmc"]),
        "No out-of-boundary record carries a BMC ward label",
    )
    check(
        report["hotspots"]["insideGreaterMumbai"] == len(in_city),
        "Report inside-Greater-Mumbai count matches the generated file",
        f"{len(in_city)}",
    )
    check(
        report["hotspots"]["total"] == len(hotspots),
        "Report total hotspot count matches the generated file",
        f"{len(hotspots)}",
    )

    ward_counts: dict[str, int] = {}
    for p in in_city:
        ward_counts[p["ward"]] = ward_counts.get(p["ward"], 0) + 1
    check(
        report["hotspots"]["wardCoverage"] == len(ward_counts),
        "Report ward coverage matches distinct wards in the file",
        f"{len(ward_counts)}",
    )

    # --- scoring formula (mirrors src/lib/scoring.ts) ------------------------
    max_ward = max(ward_counts.values())
    scores = []
    for p in in_city:
        sev = p["severity"] or 0
        depth = p["depthCm"] or 0
        score = round(
            100
            * (
                SEVERITY_WEIGHT * min(sev / 5, 1)
                + DEPTH_WEIGHT * min(depth / DEPTH_CAP_CM, 1)
                + DENSITY_WEIGHT * (ward_counts[p["ward"]] / max_ward)
            )
        )
        scores.append(score)
    check(all(0 <= s <= 100 for s in scores), "Recomputed scores stay inside 0–100", f"{len(scores)} records")
    band_counts = {
        "A": sum(s >= BANDS["A"] for s in scores),
        "B": sum(BANDS["B"] <= s < BANDS["A"] for s in scores),
        "C": sum(BANDS["C"] <= s < BANDS["B"] for s in scores),
        "watch": sum(s < BANDS["C"] for s in scores),
    }
    check(
        sum(band_counts.values()) == len(scores),
        "Every in-city record lands in exactly one priority band",
        f"A={band_counts['A']}, B={band_counts['B']}, C={band_counts['C']}, watch={band_counts['watch']}",
    )
    check(
        all((p["severity"] is None or 1 <= p["severity"] <= 5) for p in props),
        "Reported severity values stay on the documented 1–5 scale",
    )
    check(
        all((p["depthCm"] is None or 0 < p["depthCm"] <= 300) for p in props),
        "Reported depths are positive and below a sanity ceiling",
    )
    hindmata = next((p for p in in_city if p["id"] == "hindmata"), None)
    if hindmata:
        check(
            hindmata["severity"] == 5 and hindmata["depthCm"] == 120,
            "Hindmata reported attributes unchanged from source",
            f"severity={hindmata['severity']}, depth={hindmata['depthCm']}",
        )

    # --- rainfall ------------------------------------------------------------
    check(report["rainfall"]["stations"] and len(stations) == len(report["rainfall"]["stations"]),
          "Station summary covers every gauge in the report",
          f"{len(stations)} gauges")
    bad_dates = [r["date"] for r in daily if not (r["date"][5:7] in {"06", "07", "08", "09"})]
    check(not bad_dates, "Daily series contains June–September dates only", f"{len(daily)} rows")
    seasons = sorted({r["date"][:4] for r in daily})
    per_season = {s: sum(1 for r in daily if r["date"][:4] == s) for s in seasons}
    check(all(n == 122 for n in per_season.values()), "Every season has 122 monsoon days", str(per_season))
    check(
        all(int(r["stations_used"]) >= report["rainfall"]["minStationsPerDay"] for r in daily if r["city_mm"]),
        "Every city value meets the minimum reporting-gauge rule",
        f"min {report['rainfall']['minStationsPerDay']}",
    )
    check(
        report["rainfall"]["dailyComplete"] == sum(1 for r in daily if r["city_mm"]),
        "Report complete-day count matches the daily file",
    )
    totals_ok = all(0 <= float(r["city_mm"]) < 1000 for r in daily if r["city_mm"])
    check(totals_ok, "Daily city rainfall is within a plausible 0–1000 mm range")
    check(
        report["rainfall"].get("gaugeObservations", 0) > len(daily),
        "Report exposes a gauge-observation count larger than the day count",
        f"{report['rainfall'].get('gaugeObservations', 0):,} values across {len(daily)} days",
    )

    # --- IMD ----------------------------------------------------------------
    years = [int(r["Year"]) for r in imd]
    check(
        len(imd) == report["imdMonthly"]["rows"] and years[0] == report["imdMonthly"]["startYear"] and years[-1] == report["imdMonthly"]["endYear"],
        "IMD monthly series matches the report period",
        f"{years[0]}–{years[-1]}, {len(imd)} rows",
    )
    check(all(float(r["Total"]) > 0 for r in imd), "Every IMD annual total is positive")

    # --- output --------------------------------------------------------------
    failed = 0
    for ok, label in results:
        print(f"{'PASS' if ok else 'FAIL'}  {label}")
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
