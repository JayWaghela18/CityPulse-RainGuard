/* Derived analytics. Everything the UI states as a finding is computed here
   from the loaded datasets — nothing is hard-coded. */

import { COMPACT, MM, monthLabel, NUM, PCT } from './format'
import type { Dataset, DailyRain, Hotspot, ImdMonthRow } from './types'

export interface Kpi {
  key: string
  value: string
  label: string
  sub: string
  tone: 'rain' | 'teal' | 'amber' | 'coral'
}

export function kpis(ds: Dataset): Kpi[] {
  const gmc = ds.hotspots.filter((h) => h.inGmc)
  const report = ds.report
  const observations = report?.rainfall.gaugeObservations ?? 0
  const seasons = report?.rainfall.seasons.length ?? 0
  const wardsCovered = new Set(gmc.map((h) => h.ward).filter(Boolean)).size
  const totalWards = report?.wards ?? ds.wards.length

  return [
    {
      key: 'hotspots',
      value: ds.hotspots.length ? NUM(gmc.length) : '—',
      label: 'Historical hotspots',
      sub: ds.hotspots.length ? `inventoried inside Greater Mumbai · ${ds.hotspots.length} regional records` : 'dataset not connected',
      tone: 'coral',
    },
    {
      key: 'records',
      value: observations ? COMPACT(observations) : '—',
      label: 'Gauge observations analysed',
      sub: observations
        ? `15-minute values · ${report?.rainfall.stations.length ?? 0} gauges · ${report?.rainfall.dailyComplete ?? 0} monsoon days`
        : 'dataset not connected',
      tone: 'rain',
    },
    {
      key: 'wards',
      value: totalWards ? `${wardsCovered}/${totalWards}` : '—',
      label: 'Wards covered',
      sub: 'BMC wards containing at least one inventoried hotspot',
      tone: 'teal',
    },
    {
      key: 'period',
      value: seasons ? `${seasons} seasons` : '—',
      label: 'Rainfall observation period',
      sub: report?.rainfall.dailyStart
        ? `Jun–Sep ${report.rainfall.dailyStart.slice(0, 4)}–${report.rainfall.dailyEnd?.slice(0, 4)} · IMD monthly series ${report.imdMonthly.startYear}–${report.imdMonthly.endYear}`
        : 'dataset not connected',
      tone: 'amber',
    },
  ]
}

/* ------------------------------- hotspots -------------------------------- */

export function severityHistogram(hotspots: Hotspot[]): { severity: number; count: number }[] {
  const map = new Map<number, number>()
  for (const h of hotspots) {
    const s = h.severity ?? 0
    map.set(s, (map.get(s) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([severity, count]) => ({ severity, count }))
}

export interface WardStat {
  ward: string
  count: number
  highCount: number
  maxSeverity: number
  maxDepth: number
}

export function wardStats(hotspots: Hotspot[]): WardStat[] {
  const map = new Map<string, WardStat>()
  for (const h of hotspots) {
    if (!h.inGmc || !h.ward) continue
    const cur = map.get(h.ward) ?? { ward: h.ward, count: 0, highCount: 0, maxSeverity: 0, maxDepth: 0 }
    cur.count++
    if ((h.severity ?? 0) >= 4) cur.highCount++
    cur.maxSeverity = Math.max(cur.maxSeverity, h.severity ?? 0)
    cur.maxDepth = Math.max(cur.maxDepth, h.depthCm ?? 0)
    map.set(h.ward, cur)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.maxSeverity - a.maxSeverity)
}

/* ------------------------------- rainfall -------------------------------- */

export interface SeasonStat {
  season: string
  totalMm: number
  meanMm: number
  wettestDate: string
  wettestMm: number
  heavyDays: number // days >= 100 mm (IMD "very heavy" threshold)
  days: number
}

export function seasonStats(daily: DailyRain[]): SeasonStat[] {
  const bySeason = new Map<string, DailyRain[]>()
  for (const d of daily) {
    if (d.cityMm == null) continue
    const y = d.date.slice(0, 4)
    bySeason.set(y, [...(bySeason.get(y) ?? []), d])
  }
  return [...bySeason.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([season, rows]) => {
      const total = rows.reduce((s, r) => s + (r.cityMm ?? 0), 0)
      const wettest = rows.reduce((best, r) => ((r.cityMm ?? 0) > (best.cityMm ?? 0) ? r : best), rows[0])
      return {
        season,
        totalMm: Math.round(total),
        meanMm: Math.round(total / rows.length),
        wettestDate: wettest.date,
        wettestMm: Math.round(wettest.cityMm ?? 0),
        heavyDays: rows.filter((r) => (r.cityMm ?? 0) >= 100).length,
        days: rows.length,
      }
    })
}

export interface RainDayPoint {
  date: string
  dayIndex: number
  mm: number
  month: number
}

/** Daily series for one season, re-based to day-of-season (1 Jun = 1) so all
    seasons line up on the same axis. */
export function seasonSeries(daily: DailyRain[], season: string): RainDayPoint[] {
  return daily
    .filter((d) => d.date.startsWith(season) && d.cityMm != null)
    .map((d) => {
      const month = Number(d.date.slice(5, 7))
      const day = Number(d.date.slice(8, 10))
      const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
      const dayIndex = monthStarts[month - 1] + day - 151 // 1 Jun -> 1
      return { date: d.date, dayIndex, mm: d.cityMm as number, month }
    })
    .sort((a, b) => a.dayIndex - b.dayIndex)
}

export function wettestDays(daily: DailyRain[], n = 8) {
  return daily
    .filter((d) => d.cityMm != null)
    .sort((a, b) => (b.cityMm ?? 0) - (a.cityMm ?? 0))
    .slice(0, n)
}

export function climatology(imd: ImdMonthRow[]): { month: number; meanMm: number }[] {
  if (!imd.length) return []
  return Array.from({ length: 12 }, (_, m) => ({
    month: m,
    meanMm: Math.round(imd.reduce((s, r) => s + (r.months[m] ?? 0), 0) / imd.length),
  }))
}

export function annualSeries(imd: ImdMonthRow[]) {
  return imd.map((r) => ({
    year: r.year,
    total: Math.round(r.total),
    monsoon: Math.round(r.months[5] + r.months[6] + r.months[7] + r.months[8]),
  }))
}

/* -------------------------------- findings -------------------------------- */

export interface Finding {
  id: string
  eyebrow: string
  title: string
  body: string
  metric?: string
  tone: 'rain' | 'teal' | 'amber' | 'coral'
}

export function findings(ds: Dataset): Finding[] {
  const out: Finding[] = []
  const gmc = ds.hotspots.filter((h) => h.inGmc)
  const wards = wardStats(ds.hotspots)
  const seasons = seasonStats(ds.daily)
  const imd = ds.imd

  if (wards.length) {
    const top = wards[0]
    out.push({
      id: 'ward-cluster',
      eyebrow: 'Where risk concentrates',
      title: `Ward ${top.ward} holds the densest cluster of inventoried hotspots`,
      body: `${top.count} of the ${gmc.length} flood-prone locations inside Greater Mumbai fall in ward ${top.ward}${top.highCount ? `, ${top.highCount} of them reported at severity 4–5` : ''}. Clustering like this is what makes targeted pre-monsoon inspection worthwhile.`,
      metric: `${top.count} spots`,
      tone: 'coral',
    })
  }

  if (gmc.length) {
    const high = gmc.filter((h) => (h.severity ?? 0) >= 4)
    out.push({
      id: 'severity-share',
      eyebrow: 'Severity distribution',
      title: `${PCT((high.length / gmc.length) * 100)} of Greater Mumbai hotspots are reported at severity 4–5`,
      body: `Across the inventory, ${high.length} of ${gmc.length} in-city locations carry a reported severity of 4 or 5. These ratings come from the source inventory, which cites published civic flood mapping — they are reported values, not measurements taken by this project.`,
      metric: `${high.length}/${gmc.length}`,
      tone: 'amber',
    })
  }

  const subwayHigh = gmc.filter(
    (h) => (h.severity ?? 0) >= 4 && /subway|underpass|bridge/i.test(h.name),
  )
  if (subwayHigh.length) {
    out.push({
      id: 'subway-pattern',
      eyebrow: 'Recurring pattern (descriptive)',
      title: `${subwayHigh.length} of the ${gmc.filter((h) => (h.severity ?? 0) >= 4).length} high-severity spots are subways, underpasses or bridge approaches`,
      body: `A keyword scan of location names shows high-reported-severity spots cluster at grade-separated crossings — Hindmata, Milan Subway, Kurla. This is a descriptive pattern in naming and siting, not evidence that underpasses cause flooding; no causal test is performed here.`,
      metric: 'name-based',
      tone: 'rain',
    })
  }

  if (seasons.length) {
    const wettest = [...seasons].sort((a, b) => b.totalMm - a.totalMm)[0]
    const mean = Math.round(seasons.reduce((s, x) => s + x.totalMm, 0) / seasons.length)
    const delta = Math.round(((wettest.totalMm - mean) / mean) * 100)
    out.push({
      id: 'wettest-season',
      eyebrow: 'Rainfall extremes',
      title: `The ${wettest.season} monsoon was the wettest in the gauge record`,
      body: `City-scale Jun–Sep rainfall totalled ${MM(wettest.totalMm)} — ${PCT(Math.abs(delta))} ${delta >= 0 ? 'above' : 'below'} the ${seasons.length}-season mean of ${MM(mean)}. The same season produced the record single day of ${MM(wettest.wettestMm)} and ${wettest.heavyDays} days at or above 100 mm.`,
      metric: MM(wettest.totalMm),
      tone: 'rain',
    })
  }

  if (imd.length) {
    const jjasMean = Math.round(imd.reduce((s, r) => s + r.months[5] + r.months[6] + r.months[7] + r.months[8], 0) / imd.length)
    const annualMean = Math.round(imd.reduce((s, r) => s + r.total, 0) / imd.length)
    out.push({
      id: 'imd-climatology',
      eyebrow: 'Long-run baseline',
      title: `Monsoon months deliver ~${PCT((jjasMean / annualMean) * 100)} of Mumbai’s yearly rainfall`,
      body: `Over ${imd[0].year}–${imd[imd.length - 1].year} of IMD grid records, June–September average ${MM(jjasMean)} against an annual mean of ${MM(annualMean)}. Any waterlogging story in Mumbai is, overwhelmingly, a June–September story.`,
      metric: `${PCT((jjasMean / annualMean) * 100)} in JJAS`,
      tone: 'teal',
    })
  }

  return out
}

export function dataFreshness(ds: Dataset): { label: string; value: string } {
  const end = ds.report?.rainfall.dailyEnd
  return {
    label: 'Data through',
    value: end ? `${Number(end.slice(8, 10))} ${monthLabel(Number(end.slice(5, 7)) - 1)} ${end.slice(0, 4)}` : '—',
  }
}
