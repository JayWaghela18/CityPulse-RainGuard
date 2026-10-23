import { CalendarDays, CloudRain, Database } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { climatology, findings, seasonSeries, seasonStats, wardStats, wettestDays } from '../lib/analytics'
import { MM, dayMonth, monthLabel, severityMeta } from '../lib/format'
import type { Dataset } from '../lib/types'
import {
  AMBER,
  AXIS_TICK,
  ChartShell,
  ChartTooltip,
  CORAL,
  GRID,
  RAIN,
  RAIN_DEEP,
  TEAL,
} from '../components/charts/charts'
import { EmptyState, FindingCard, SectionHeader } from '../components/ui/bits'

const SEASON_TICKS = [
  { v: 1, label: 'Jun' },
  { v: 32, label: 'Jul' },
  { v: 62, label: 'Aug' },
  { v: 93, label: 'Sep' },
  { v: 122, label: 'End' },
]

export function Insights({ ds }: { ds: Dataset }) {
  const seasons = useMemo(() => seasonStats(ds.daily), [ds.daily])
  const [season, setSeason] = useState(() => (seasons.length ? seasons[seasons.length - 1].season : '2022'))

  const series = useMemo(() => seasonSeries(ds.daily, season), [ds.daily, season])

  const meanByDay = useMemo(() => {
    const buckets = new Map<number, number[]>()
    for (const s of seasons) {
      for (const p of seasonSeries(ds.daily, s.season)) {
        buckets.set(p.dayIndex, [...(buckets.get(p.dayIndex) ?? []), p.mm])
      }
    }
    const mean = new Map<number, number>()
    for (const [idx, vals] of buckets) {
      mean.set(idx, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10)
    }
    const out = series.map((p) => ({ dayIndex: p.dayIndex, meanMm: mean.get(p.dayIndex) ?? 0 }))
    return out
  }, [seasons, ds.daily, series])

  const dailyData = useMemo(
    () =>
      series.map((p) => ({
        dayIndex: p.dayIndex,
        date: p.date,
        mm: Math.round(p.mm * 10) / 10,
        meanMm: meanByDay.find((m) => m.dayIndex === p.dayIndex)?.meanMm ?? 0,
      })),
    [series, meanByDay],
  )

  const climate = useMemo(() => climatology(ds.imd), [ds.imd])
  const annual = useMemo(
    () => ds.imd.map((r) => ({ year: r.year, total: Math.round(r.total), monsoon: Math.round(r.months[5] + r.months[6] + r.months[7] + r.months[8]) })),
    [ds.imd],
  )
  const annualMean = annual.length ? Math.round(annual.reduce((s, r) => s + r.total, 0) / annual.length) : 0

  const wardSeverity = useMemo(() => {
    const map = new Map<string, Record<number, number>>()
    for (const h of ds.hotspots) {
      if (!h.inGmc || !h.ward) continue
      const row = map.get(h.ward) ?? { 2: 0, 3: 0, 4: 0, 5: 0 }
      if (h.severity != null) row[h.severity] = (row[h.severity] ?? 0) + 1
      map.set(h.ward, row)
    }
    return [...map.entries()]
      .map(([ward, counts]) => ({ ward, ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 9)
      .reverse()
  }, [ds.hotspots])

  const depthBins = useMemo(() => {
    const bins = [
      { label: '≤ 30 cm', min: 0, max: 30 },
      { label: '31–60', min: 31, max: 60 },
      { label: '61–90', min: 61, max: 90 },
      { label: '91–120', min: 91, max: 120 },
      { label: '> 120', min: 121, max: Infinity },
    ]
    return bins.map((b) => ({
      label: b.label,
      count: ds.hotspots.filter((h) => h.inGmc && h.depthCm != null && h.depthCm >= b.min && h.depthCm <= b.max).length,
    }))
  }, [ds.hotspots])

  const topDays = useMemo(() => wettestDays(ds.daily, 8), [ds.daily])
  const found = findings(ds)
  const selectedStat = seasons.find((s) => s.season === season) ?? null
  const stationsTop = useMemo(() => [...ds.stations].sort((a, b) => b.totalMm - a.totalMm).slice(0, 6), [ds.stations])
  const wardCount = wardStats(ds.hotspots).length

  const hasRain = ds.daily.length > 0 && seasons.length > 0
  const hasLongRun = ds.imd.length > 0

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <SectionHeader
        eyebrow="Rainfall & insights"
        title="The rain record behind the map"
        sub="Eight completed monsoon seasons of automatic rain-gauge data, plus a 121-year IMD monthly record. Everything below is computed from those files — no illustrative or placeholder series exist anywhere in this product."
      />

      {selectedStat && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Headline label="Season rainfall (city scale)" value={MM(selectedStat.totalMm)} tone={RAIN} />
          <Headline label="Days with ≥ 100 mm" value={`${selectedStat.heavyDays}`} tone={AMBER} />
          <Headline label="Wettest single day" value={MM(selectedStat.wettestMm)} sub={dayMonth(selectedStat.wettestDate)} tone={CORAL} />
          <Headline label="Season mean per day" value={MM(selectedStat.meanMm)} tone={TEAL} />
        </div>
      )}

      {hasRain && (
        <ChartShell
          title={`Daily rainfall through the ${season} monsoon`}
          sub="City-scale mean across reporting rain gauges. The dashed line is the mean of all recorded seasons for the same day."
          height={320}
          meta="Jun–Sep only: the source file records the monsoon window, and each season has 122 complete days. A missing gauge-day appears as a gap, never as zero rainfall."
          action={
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-fog-600" />
              <select className="field" value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Select monsoon season">
                {seasons.map((s) => (
                  <option key={s.season} value={s.season}>
                    {s.season}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <ComposedChart data={dailyData} margin={{ top: 6, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="rainArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RAIN} stopOpacity={0.55} />
                <stop offset="100%" stopColor={RAIN} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="dayIndex"
              type="number"
              domain={[1, 122]}
              ticks={SEASON_TICKS.map((t) => t.v)}
              tickFormatter={(v) => SEASON_TICKS.find((t) => t.v === v)?.label ?? ''}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" mm" />
            <ChartTooltip
              formatter={(v, name) => `${v} mm${name === 'Season mean' ? ' (avg)' : ''}`}
              labelFormatter={(_, payload) => {
                const iso = payload?.[0]?.payload?.date
                return typeof iso === 'string' ? dayMonth(iso) : ''
              }}
              cursorFill="rgba(255,255,255,0.03)"
            />
            <Area type="monotone" dataKey="mm" name="Daily total" stroke={RAIN} strokeWidth={1.4} fill="url(#rainArea)" />
            <Line type="monotone" dataKey="meanMm" name="Season mean" stroke={TEAL} strokeWidth={1.2} strokeDasharray="4 4" dot={false} />
            <ReferenceLine y={100} stroke={AMBER} strokeDasharray="2 6" strokeOpacity={0.55} />
          </ComposedChart>
        </ChartShell>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {hasLongRun && (
          <ChartShell
            title="Mumbai’s long-run annual rainfall"
            sub={`IMD grid record 72.75°E, 19.00°N · ${ds.imd[0].year}–${ds.imd[ds.imd.length - 1].year}`}
            height={260}
            meta={`Mean ${annualMean.toLocaleString('en-US')} mm per year (dashed line). This is a single grid cell, not a city average of stations.`}
          >
            <ComposedChart data={annual} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={19} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} />
              <ChartTooltip formatter={(v) => `${v.toLocaleString('en-US')} mm`} />
              <ReferenceLine y={annualMean} stroke={TEAL} strokeDasharray="4 4" strokeOpacity={0.7} />
              <Bar dataKey="monsoon" name="Jun–Sep rainfall" fill={RAIN_DEEP} radius={[3, 3, 0, 0]} maxBarSize={7} />
              <Line type="monotone" dataKey="total" name="Annual total" stroke={RAIN} strokeWidth={1.4} dot={false} />
            </ComposedChart>
          </ChartShell>
        )}

        {hasLongRun && (
          <ChartShell
            title="Monthly rainfall climatology"
            sub={`Mean monthly rainfall across ${ds.imd.length} years of IMD records`}
            height={260}
            meta="June–September dominates the annual cycle. Months outside the monsoon are orders of magnitude drier and are plotted honestly at their real values."
          >
            <BarChart data={climate.map((c) => ({ ...c, name: monthLabel(c.month) }))} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} />
              <ChartTooltip formatter={(v) => `${v.toLocaleString('en-US')} mm`} />
              <Bar dataKey="meanMm" name="Mean rainfall" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {climate.map((c) => (
                  <Cell key={c.month} fill={c.month >= 5 && c.month <= 8 ? RAIN : '#2a5d86'} />
                ))}
              </Bar>
            </BarChart>
          </ChartShell>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartShell
          title="Recurring hotspots by ward"
          sub="Inventoried Greater Mumbai locations, stacked by reported severity"
          height={300}
          meta={
            wardCount
              ? `Top ${wardSeverity.length} of ${wardCount} wards holding at least one inventoried location. Severity is reported by the source inventory.`
              : 'No ward data loaded.'
          }
        >
          <BarChart data={wardSeverity} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="ward" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <ChartTooltip />
            {[2, 3, 4, 5].map((s) => (
              <Bar key={s} dataKey={s} name={`Sev ${s}`} stackId="a" fill={severityMeta(s).color} maxBarSize={38} />
            ))}
          </BarChart>
        </ChartShell>

        <ChartShell
          title="Reported ponding-depth distribution"
          sub="Greater Mumbai locations with a reported maximum depth"
          height={300}
          meta="Depth is a reported attribute of the source inventory, not a measurement by this project. Locations without a depth field are excluded rather than assumed."
        >
          <BarChart data={depthBins} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <ChartTooltip />
            <Bar dataKey="count" name="Locations" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ChartShell>
      </div>

      {/* tables */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h3 className="text-[14.5px] font-semibold text-fog-100">Heaviest recorded rainfall days</h3>
          <p className="mt-1 text-[12px] text-fog-500">City-scale daily totals across all gauge seasons.</p>
          {topDays.length ? (
            <table className="mt-3 w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-fog-600">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Season</th>
                  <th className="pb-2 text-right font-medium">Rainfall</th>
                </tr>
              </thead>
              <tbody>
                {topDays.map((d) => (
                  <tr key={d.date} className="border-b border-white/[0.05] last:border-0">
                    <td className="py-2 text-fog-300">{dayMonth(d.date)}</td>
                    <td className="py-2 text-fog-600">{d.date.slice(0, 4)}</td>
                    <td className="num py-2 text-right font-semibold text-rain-300">{MM(d.cityMm ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-[12.5px] text-fog-500">No daily record loaded.</p>
          )}
        </section>

        <section className="panel p-5">
          <h3 className="text-[14.5px] font-semibold text-fog-100">Wettest gauges across the record</h3>
          <p className="mt-1 text-[12px] text-fog-500">Total Jun–Sep rainfall per automatic gauge, all available years.</p>
          {stationsTop.length ? (
            <ul className="mt-3 space-y-2">
              {stationsTop.map((s, i) => {
                const max = stationsTop[0]?.totalMm || 1
                return (
                  <li key={s.station} className="flex items-center gap-3 text-[12.5px]">
                    <span className="num w-4 text-right text-fog-600">{i + 1}</span>
                    <span className="w-[112px] shrink-0 truncate text-fog-300">{s.station}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.round((s.totalMm / max) * 100)}%`, background: `linear-gradient(90deg,${RAIN_DEEP},${RAIN})` }}
                      />
                    </span>
                    <span className="num w-[74px] text-right font-semibold text-fog-100">{MM(s.totalMm)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[12.5px] text-fog-500">No gauge summary loaded.</p>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-fog-600">
            Gauge totals differ across the city — a reminder that the city-scale line understates local
            extremes. We do not assign these totals to wards, because the source lists station names without
            coordinates.
          </p>
        </section>
      </div>

      {/* insights */}
      <section className="mt-10">
        <SectionHeader eyebrow="What this means" title="Insights from the connected record" />
        {found.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {found.map((f, i) => (
              <FindingCard key={f.id} finding={f} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Database size={22} />}
            title="Insights need data"
            body="Connect the rainfall and hotspot datasets to generate findings. This page intentionally shows no illustrative numbers."
          />
        )}
      </section>

      {!hasRain && !hasLongRun && (
        <EmptyState
          icon={<CloudRain size={22} />}
          title="Rainfall records not connected"
          body="Drop rainfall CSVs into public/data and run the preparation script. Charts here only render real observations."
        />
      )}
    </div>
  )
}

function Headline({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-fog-600">{label}</div>
      <div className="num mt-1.5 text-[24px] font-semibold leading-none" style={{ color: tone }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-fog-500">{sub}</div>}
    </div>
  )
}
