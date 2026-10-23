import { ArrowUpRight, BookOpen, CloudRain, Database, Map as MapIcon, ShieldCheck, Sparkles } from 'lucide-react'
import { Bar, BarChart, Cell, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'
import { findings, kpis, seasonStats, wardStats } from '../lib/analytics'
import { COMPACT, SEVERITY_META } from '../lib/format'
import type { Route } from '../lib/routes'
import type { Dataset } from '../lib/types'
import { MumbaiMap } from '../components/map/MumbaiMap'
import { MapLegend } from '../components/map/MapLegend'
import { AXIS_TICK, ChartShell, ChartTooltip, CORAL, GRID, RAIN } from '../components/charts/charts'
import { EmptyState, FindingCard, KpiTile, SectionHeader } from '../components/ui/bits'

export function Overview({
  ds,
  onNavigate,
  onOpenSpot,
  onStartTour,
}: {
  ds: Dataset
  onNavigate: (r: Route) => void
  onOpenSpot: (id: string) => void
  onStartTour: () => void
}) {
  const kpiList = kpis(ds)
  const found = findings(ds)
  const seasons = seasonStats(ds.daily)
  const wards = wardStats(ds.hotspots).slice(0, 8)
  const sevHist = (function () {
    const m = new Map<number, number>()
    for (const h of ds.hotspots) {
      if (h.severity != null) m.set(h.severity, (m.get(h.severity) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => ({ name: `Sev ${s}`, severity: s, count: n }))
  })()

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* ------------------------------- hero ------------------------------- */}
      <section className="grid items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="fade-up">
          <div className="eyebrow mb-4 flex items-center gap-2 text-rain-400/90">
            <CloudRain size={13} /> Mumbai · Monsoon Intelligence
          </div>
          <h1 className="display text-[clamp(34px,5.2vw,56px)] text-fog-100">
            Understand the city.
            <br />
            <span className="text-rain-400">Navigate the monsoon.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-fog-300">
            CityPulse RainGuard maps Mumbai’s historical road-waterlogging hotspots against real public
            rainfall records — so residents know where the city has struggled before, and civic teams can
            decide where to inspect ahead of heavy rain. Every number here is traceable to a public dataset;
            nothing on screen is simulated.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button className="btn-primary" onClick={() => onNavigate('explore')}>
              <MapIcon size={15} /> Open the intelligence map
            </button>
            <button className="btn-ghost" onClick={() => onNavigate('methodology')}>
              <BookOpen size={14} /> How the analysis works
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 px-2 text-[12.5px] font-medium text-fog-500 underline-offset-4 transition hover:text-rain-200 hover:underline"
              onClick={onStartTour}
            >
              <Sparkles size={13} /> Take the 90-second tour
            </button>
          </div>
        </div>

        {/* connected data status */}
        <div className="fade-up panel p-5" style={{ animationDelay: '90ms' }}>
          <div className="eyebrow mb-3">Connected datasets</div>
          <ul className="space-y-2.5 text-[12.5px]">
            <StatusRow
              ok={ds.hotspots.length > 0}
              icon={<ShieldCheck size={13.5} />}
              label="Flood-spot inventory"
              value={ds.hotspots.length ? `${ds.hotspots.length} locations · ${ds.hotspots.filter((h) => h.inGmc).length} in Greater Mumbai` : 'not connected'}
            />
            <StatusRow
              ok={ds.daily.length > 0}
              icon={<CloudRain size={13.5} />}
              label="Automatic rain gauges"
              value={
                ds.daily.length
                  ? `${COMPACT(ds.report?.rainfall.gaugeObservations ?? 0)} gauge values · ${ds.report?.rainfall.seasons.length} Jun–Sep seasons`
                  : 'not connected'
              }
            />
            <StatusRow
              ok={ds.imd.length > 0}
              icon={<Database size={13.5} />}
              label="IMD monthly rainfall"
              value={ds.imd.length ? `${ds.imd[0].year}–${ds.imd[ds.imd.length - 1].year} grid record` : 'not connected'}
            />
            <StatusRow
              ok={ds.wards.length > 0}
              icon={<MapIcon size={13.5} />}
              label="BMC ward boundaries"
              value={ds.wards.length ? `${ds.wards.length} municipal wards` : 'not connected'}
            />
          </ul>
          <div className="hairline my-4" />
          <p className="text-[11.5px] leading-relaxed text-fog-600">
            {ds.failures.length
              ? `Some files could not be loaded: ${ds.failures.join(', ')}. Affected views show honest empty states.`
              : 'All prepared datasets loaded. Historical records only — this product never claims live road conditions.'}
          </p>
        </div>
      </section>

      {/* -------------------------------- KPIs -------------------------------- */}
      <section className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiList.map((k) => (
          <KpiTile key={k.key} kpi={k} />
        ))}
      </section>

      {/* ------------------------------- map lead ---------------------------- */}
      <section className="mt-10">
        <SectionHeader
          eyebrow="The signature view"
          title="Where Mumbai has struggled with water"
          sub="Inventoried flood-prone locations against BMC ward boundaries. Marker colour follows the reported severity scale used across the entire product."
          right={
            <button className="btn-ghost" onClick={() => onNavigate('explore')}>
              Explore in full <ArrowUpRight size={14} />
            </button>
          }
        />
        <div className="panel relative h-[clamp(400px,56vh,600px)] overflow-hidden">
          {ds.hotspots.length ? (
            <>
              <MumbaiMap
                className="absolute inset-0"
                hotspots={ds.hotspots}
                wards={ds.wards}
                selectedId={null}
                onSelect={(id) => id && onOpenSpot(id)}
                mode="points"
                basemap="dark"
                showWards
                compactControls
                overlay={
                  <>
                    <MapLegend />
                    <div className="absolute bottom-3 right-3 z-[500] rounded-[10px] border border-white/10 bg-ink-850/90 px-3 py-2 text-[11px] text-fog-500 backdrop-blur">
                      Click a marker to inspect its evidence
                    </div>
                  </>
                }
              />
            </>
          ) : (
            <div className="grid h-full place-items-center p-6">
              <EmptyState
                compact
                icon={<Database size={22} />}
                title="Historical hotspot dataset not connected"
                body="Add public/data/hotspots.json (a GeoJSON FeatureCollection of locations with ward, severity and depth fields) and the map will render it automatically — see the README data-import section."
              />
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ findings ----------------------------- */}
      <section className="mt-12">
        <SectionHeader
          eyebrow="Evidence, not adjectives"
          title="The strongest findings the data supports"
          sub="Computed live from the loaded datasets. Where a statement is descriptive rather than causal, it says so."
        />
        {found.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {found.map((f, i) => (
              <FindingCard key={f.id} finding={f} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Database size={22} />}
            title="Findings appear once data is connected"
            body="This section computes ward clusters, severity distribution and rainfall extremes from the loaded public datasets. With none loaded, we show nothing rather than inventing numbers."
          />
        )}
      </section>

      {/* --------------------------- pattern summary ------------------------- */}
      <section className="mt-12">
        <SectionHeader
          eyebrow="Visual summary"
          title="Historical patterns at a glance"
          sub="Three views of the same evidence: how the inventory distributes across severities, how monsoon rainfall has varied across the gauge record, and where inventoried locations cluster by ward."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartShell
            title="Reported severity distribution"
            sub="All locations in the connected inventory"
            height={230}
            meta="Severity ratings are reported by the source inventory (compiled from published civic flood mapping) — not measured by this project."
          >
            <BarChart data={sevHist} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <ChartTooltip />
              <Bar dataKey="count" name="Locations" radius={[5, 5, 0, 0]} maxBarSize={46}>
                {sevHist.map((d) => (
                  <Cell key={d.severity} fill={SEVERITY_META[d.severity]?.color ?? '#7d8db1'} />
                ))}
              </Bar>
            </BarChart>
          </ChartShell>

          <ChartShell
            title="Monsoon rainfall by season"
            sub={`City-scale Jun–Sep totals, ${seasons[0]?.season ?? '—'}–${seasons[seasons.length - 1]?.season ?? '—'}`}
            height={230}
            meta={`Mean of daily totals across up to ${ds.report?.rainfall.stations.length ?? 0} automatic rain gauges (minimum 5 reporting gauges per day). Days that fail the threshold appear as gaps, never as zero.`}
          >
            <BarChart data={seasons} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="season" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <ChartTooltip formatter={(v) => `${v.toLocaleString('en-US')} mm`} />
              <Bar dataKey="totalMm" name="Season total" fill={RAIN} radius={[5, 5, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartShell>

          <ChartShell
            title="Wards with the most inventoried hotspots"
            sub="Greater Mumbai only — top 8 wards"
            height={230}
            meta="Counts come from point-in-polygon assignment of inventory coordinates against DataMeet BMC ward boundaries."
          >
            <BarChart data={wards} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="ward" tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
              <ChartTooltip />
              <Bar dataKey="count" name="Locations" fill={CORAL} radius={[0, 5, 5, 0]} maxBarSize={18} />
            </BarChart>
          </ChartShell>
        </div>
      </section>

      {/* ---------------------------- coverage strip ------------------------- */}
      <section className="mt-12">
        <SectionHeader
          eyebrow="Coverage & freshness"
          title="What is loaded, and what is not"
          sub="Public datasets only. Where a public file did not exist, we say so instead of fabricating an integration."
        />
        <div className="panel divide-y divide-white/[0.06]">
          <CoverageRow
            name="BMC ward boundaries (DataMeet)"
            period={`${ds.wards.length} municipal wards, Greater Mumbai`}
            note="CC BY-SA 2.5 India · github.com/datameet/Municipal_Spatial_Data"
          />
          <CoverageRow
            name="Flood-spot inventory (Rasta Radar)"
            period={
              ds.report
                ? `${ds.report.hotspots.total} regional records · ${ds.report.hotspots.insideGreaterMumbai} inside Greater Mumbai · 22/24 wards covered`
                : 'not connected'
            }
            note="MIT licence · compiled from published civic flood mapping — reported, not independently verified"
          />
          <CoverageRow
            name="Automatic rain-gauge readings (15-min)"
            period={
              ds.report?.rainfall.dailyStart
                ? `Jun–Sep ${ds.report.rainfall.dailyStart.slice(0, 4)}–${ds.report.rainfall.dailyEnd?.slice(0, 4)} · ${(ds.report.rainfall.gaugeObservations ?? 0).toLocaleString('en-US')} values · ${ds.report.rainfall.dailyComplete}/${ds.report.rainfall.expectedDays} days complete · ${ds.report.rainfall.stations.length} gauges`
                : 'not connected'
            }
            note="Recent record — city-scale daily series derived in scripts/prepare_data.py"
          />
          <CoverageRow
            name="IMD monthly rainfall (grid 72.75°E, 19.00°N)"
            period={
              ds.report
                ? `${ds.report.imdMonthly.startYear}–${ds.report.imdMonthly.endYear} · mean ${ds.report.imdMonthly.meanAnnualMm.toLocaleString('en-US')} mm/year`
                : 'not connected'
            }
            note="Public domain via OpenCity · source: India Meteorological Department"
          />
          <CoverageRow
            name="Dated waterlogging incident log"
            period="No verified public dataset found"
            note="BMC/data.gov.in expose no downloadable dated incident CSV we could verify — import one via scripts/prepare_data.py to unlock incident-time analysis"
            missing
          />
        </div>
      </section>
    </div>
  )
}

function StatusRow({
  ok,
  icon,
  label,
  value,
}: {
  ok: boolean
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md"
        style={{
          background: ok ? 'rgba(47,212,168,0.14)' : 'rgba(125,141,177,0.14)',
          color: ok ? '#2fd4a8' : '#7d8db1',
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="font-semibold text-fog-100">{label}</span>
        <span className="block truncate text-[11.5px] text-fog-500">{value}</span>
      </span>
    </li>
  )
}

function CoverageRow({
  name,
  period,
  note,
  missing = false,
}: {
  name: string
  period: string
  note: string
  missing?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex items-center gap-2.5 lg:w-[280px] lg:shrink-0">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: missing ? '#f5a524' : '#2fd4a8' }}
        />
        <span className="text-[13px] font-semibold text-fog-100">{name}</span>
      </div>
      <div className="num text-[12.5px] text-fog-300 lg:w-[330px] lg:shrink-0">{period}</div>
      <div className="min-w-0 break-words text-[11.5px] leading-relaxed text-fog-600">{note}</div>
    </div>
  )
}
