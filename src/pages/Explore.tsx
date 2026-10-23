import { Database, MapPin, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { seasonStats, wardStats } from '../lib/analytics'
import { severityMeta } from '../lib/format'
import type { Route } from '../lib/routes'
import type { Dataset } from '../lib/types'
import { MapLegend } from '../components/map/MapLegend'
import { MumbaiMap, type Basemap, type MapMode } from '../components/map/MumbaiMap'
import { DetailPanel } from '../components/map/DetailPanel'
import { EmptyState } from '../components/ui/bits'

const ALL_SEVERITIES = [2, 3, 4, 5]

export function Explore({
  ds,
  selectedId,
  onSelect,
  onNavigate,
  tourActive = false,
}: {
  ds: Dataset
  selectedId: string | null
  onSelect: (id: string | null) => void
  onNavigate: (r: Route) => void
  /** While the guided tour is open, keep the mobile detail sheet closed. */
  tourActive?: boolean
}) {
  const [query, setQuery] = useState('')
  const [ward, setWard] = useState('all')
  const [severities, setSeverities] = useState<number[]>(ALL_SEVERITIES)
  const [scope, setScope] = useState<'gmc' | 'all'>('gmc')
  const [season, setSeason] = useState<string>(() => {
    const stats = seasonStats(ds.daily)
    return stats.length ? stats[stats.length - 1].season : '2022'
  })
  const [mode, setMode] = useState<MapMode>('points')
  const [basemap, setBasemap] = useState<Basemap>('dark')
  const [showWards, setShowWards] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  const seasons = useMemo(() => seasonStats(ds.daily), [ds.daily])
  const seasonStat = useMemo(() => seasons.find((s) => s.season === season) ?? null, [seasons, season])
  const wards = useMemo(() => wardStats(ds.hotspots), [ds.hotspots])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ds.hotspots.filter((h) => {
      if (scope === 'gmc' && !h.inGmc) return false
      if (ward !== 'all' && h.ward !== ward) return false
      if (h.severity != null && !severities.includes(h.severity)) return false
      if (h.severity == null && severities.length !== ALL_SEVERITIES.length) return false
      if (q && !`${h.name} ${h.area ?? ''} ${h.ward ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [ds.hotspots, query, ward, severities, scope])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[aria-labelledby="tour-title"]')) return // tour owns Esc while open
      setSheetOpen(false)
      onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSelect])

  const selected = selectedId ? (ds.hotspots.find((h) => h.id === selectedId) ?? null) : null
  const inCity = filtered.filter((h) => h.inGmc)
  const wardsInView = new Set(inCity.map((h) => h.ward).filter(Boolean)).size
  const topSeverity = filtered.reduce((max, h) => Math.max(max, h.severity ?? 0), 0)
  const filtersActive =
    query.trim() !== '' || ward !== 'all' || scope !== 'gmc' || severities.length !== ALL_SEVERITIES.length

  const clearFilters = () => {
    setQuery('')
    setWard('all')
    setScope('gmc')
    setSeverities(ALL_SEVERITIES)
  }

  const select = (id: string | null) => {
    onSelect(id)
    if (id && !tourActive) setSheetOpen(true)
  }

  const chip = (active: boolean) =>
    active
      ? { background: 'linear-gradient(180deg,#6fd2f7,#139dd9)', color: '#06101d', borderColor: 'transparent' }
      : undefined

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col overflow-hidden md:h-[calc(100dvh-3.5rem)]">
      {/* summary strip */}
      <div className="border-b border-white/[0.07] bg-ink-900/60">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-[12px]">
          <span className="num text-fog-100">
            <strong className="text-[13.5px] text-rain-300">{filtered.length}</strong> of{' '}
            {ds.hotspots.length} locations shown
          </span>
          <span className="hidden text-fog-500 sm:inline">
            <span className="num text-fog-300">{inCity.length}</span> inside Greater Mumbai
          </span>
          <span className="hidden text-fog-500 md:inline">
            <span className="num text-fog-300">{wardsInView}</span> wards in view
          </span>
          {topSeverity > 0 && (
            <span className="flex items-center gap-1.5 text-fog-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: severityMeta(topSeverity).color }}
              />
              highest reported severity in view: <span className="num text-fog-100">{topSeverity}/5</span>
            </span>
          )}
          {seasonStat && (
            <span className="hidden text-fog-500 lg:inline">
              Jun–Sep {seasonStat.season} city rainfall:{' '}
              <span className="num text-rain-300">{seasonStat.totalMm.toLocaleString('en-US')} mm</span>
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-fog-600">
            <MapPin size={11.5} /> Historical inventory — not live road conditions
          </span>
        </div>
      </div>

      {/* filter bar */}
      <div className="border-b border-white/[0.07] bg-ink-900/40 px-4 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="relative min-w-[190px] flex-1 md:max-w-[300px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-600" />
            <input
              className="field w-full pl-8"
              placeholder="Search location, area or ward…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search locations"
            />
          </div>

          <select
            className="field min-w-[120px]"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            aria-label="Filter by ward"
          >
            <option value="all">All wards</option>
            {wards.map((w) => (
              <option key={w.ward} value={w.ward}>
                Ward {w.ward} ({w.count})
              </option>
            ))}
          </select>

          <select
            className="field min-w-[150px]"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'gmc' | 'all')}
            aria-label="Geographic scope"
          >
            <option value="gmc">Greater Mumbai only</option>
            <option value="all">All regional records</option>
          </select>

          <select
            className="field min-w-[140px]"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            aria-label="Rainfall season for context"
          >
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                Season {s.season}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={13.5} className="mr-0.5 hidden text-fog-600 sm:block" />
            {ALL_SEVERITIES.map((s) => {
              const active = severities.includes(s)
              const meta = severityMeta(s)
              return (
                <button
                  key={s}
                  className="chip shrink-0"
                  style={
                    active
                      ? { ...chip(true), background: `color-mix(in oklab, ${meta.color} 90%, #06101d)`, color: '#06101d' }
                      : { borderColor: `color-mix(in oklab, ${meta.color} 45%, transparent)` }
                  }
                  aria-pressed={active}
                  onClick={() =>
                    setSeverities((cur) =>
                      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s].sort((a, b) => a - b),
                    )
                  }
                >
                  Sev {s}
                </button>
              )
            })}
          </div>

          {filtersActive && (
            <button className="btn-ghost shrink-0" onClick={clearFilters}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* map + panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-[420px] flex-1">
          <MumbaiMap
            className="absolute inset-0"
            hotspots={filtered}
            wards={ds.wards}
            selectedId={selectedId}
            onSelect={select}
            mode={mode}
            basemap={basemap}
            showWards={showWards}
            onModeChange={setMode}
            onBasemapChange={setBasemap}
            onWardsChange={setShowWards}
            fitToken={`${ward}-${scope}`}
            flyToSelected
            wheelZoom
            overlay={<MapLegend mode={mode} />}
          />

          {!ds.hotspots.length && (
            <div className="pointer-events-none absolute inset-0 z-[600] grid place-items-center bg-ink-950/50 px-6 backdrop-blur-[2px]">
              <div className="pointer-events-auto w-[min(420px,92%)]">
                <EmptyState
                  compact
                  icon={<Database size={22} />}
                  title="Hotspot inventory not connected"
                  body="public/data/hotspots.json could not be loaded, so there is nothing honest to map. Add the inventory and run scripts/prepare_data.py — the map will populate automatically."
                />
              </div>
            </div>
          )}

          {ds.hotspots.length > 0 && !filtered.length && (
            <div className="pointer-events-none absolute inset-0 z-[600] grid place-items-center bg-ink-950/50 px-6 backdrop-blur-[2px]">
              <div className="pointer-events-auto w-[min(420px,92%)]">
                <EmptyState
                  compact
                  icon={<Search size={22} />}
                  title="No locations match these filters"
                  body="Try a different ward, widen the severity selection, or switch the geographic scope to all regional records."
                  action={
                    <button className="btn-primary" onClick={clearFilters}>
                      <RotateCcw size={14} /> Clear filters
                    </button>
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* desktop detail panel */}
        <aside className="hidden w-[380px] shrink-0 overflow-hidden border-l border-white/[0.07] lg:block min-h-0">
          {selected ? (
            <DetailPanel
              hotspot={selected}
              allHotspots={ds.hotspots}
              season={season}
              seasonStat={seasonStat}
              onClose={() => onSelect(null)}
              onNavigate={onNavigate}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-fog-600">
                <MapPin size={20} />
              </div>
              <h3 className="mt-4 text-[14.5px] font-semibold text-fog-100">Select a location</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fog-500">
                Click any marker to inspect its reported evidence, ward context, rainfall history and how its
                prioritisation score is built.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {Object.entries(
                  filtered.reduce<Record<string, number>>((acc, h) => {
                    if (h.severity != null) acc[h.severity] = (acc[h.severity] ?? 0) + 1
                    return acc
                  }, {}),
                )
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([s, n]) => (
                    <span key={s} className="chip" style={{ cursor: 'default' }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: severityMeta(Number(s)).color }} />
                      Sev {s} · <span className="num">{n}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </aside>

        {/* mobile bottom sheet (suppressed while the guided tour is open) */}
        {selected && !tourActive && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[58px] z-[700] lg:hidden">
            <div
              className="pointer-events-auto max-h-[68dvh] overflow-hidden rounded-t-[18px] border-t border-white/12 bg-ink-900 shadow-[0_-24px_48px_-24px_rgba(2,6,20,0.9)] transition-transform duration-300"
              style={{ transform: sheetOpen ? 'translateY(0)' : 'translateY(calc(100% - 54px))' }}
            >
              <button
                className="flex w-full items-center justify-between px-5 pt-3 pb-1"
                onClick={() => setSheetOpen((v) => !v)}
                aria-expanded={sheetOpen}
              >
                <span className="mx-auto h-1 w-10 rounded-full bg-white/25" />
              </button>
              <button
                className="absolute right-4 top-3 grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-fog-500"
                onClick={() => onSelect(null)}
                aria-label="Close details"
              >
                <X size={14} />
              </button>
              <div className="h-[64dvh] overflow-hidden">
                <DetailPanel
                  compact
                  hotspot={selected}
                  allHotspots={ds.hotspots}
                  season={season}
                  seasonStat={seasonStat}
                  onClose={() => onSelect(null)}
                  onNavigate={onNavigate}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
