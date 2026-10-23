import { ArrowUpRight, Droplets, Info, MapPin, X } from 'lucide-react'
import { CM, MM, severityMeta } from '../../lib/format'
import type { SeasonStat } from '../../lib/analytics'
import type { Route } from '../../lib/routes'
import { CATEGORY_META, assess, wardHotspotCounts } from '../../lib/scoring'
import type { Hotspot } from '../../lib/types'
import { Badge } from '../ui/bits'

export function DetailPanel({
  hotspot,
  allHotspots,
  season,
  seasonStat,
  onClose,
  onNavigate,
  compact = false,
}: {
  hotspot: Hotspot
  allHotspots: Hotspot[]
  season: string
  seasonStat: SeasonStat | null
  onClose: () => void
  onNavigate: (r: Route) => void
  compact?: boolean
}) {
  const meta = severityMeta(hotspot.severity)
  const wardCounts = wardHotspotCounts(allHotspots)
  const assessment = assess(hotspot, wardCounts)
  const cat = CATEGORY_META[assessment.category]

  const why = buildWhy(hotspot, assessment.wardCount, seasonStat, season)

  return (
    <div className={`flex h-full flex-col ${compact ? '' : 'bg-ink-900/40'}`}>
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">Selected location</div>
          <h2 className="display truncate text-[21px] text-fog-100">{hotspot.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {hotspot.ward && <Badge color="#38bcf2">Ward {hotspot.ward}</Badge>}
            {hotspot.area && <Badge>{hotspot.area}</Badge>}
            <Badge color={hotspot.inGmc ? '#2fd4a8' : '#8fa1c4'}>
              {hotspot.inGmc ? 'Greater Mumbai' : 'Regional context'}
            </Badge>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-fog-500 transition hover:border-white/25 hover:text-fog-100"
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {/* headline metrics */}
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Reported severity" value={hotspot.severity != null ? `${hotspot.severity}/5` : '—'} color={meta.color} />
          <Metric label="Reported depth" value={hotspot.depthCm != null ? CM(hotspot.depthCm) : '—'} color="#38bcf2" />
          <Metric label="Priority score" value={`${assessment.score}`} color={cat.color} />
        </div>

        {/* why */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-fog-100">
            <Info size={13.5} className="text-rain-400" /> Why this location deserves attention
          </h3>
          <p className="text-[12.5px] leading-relaxed text-fog-300">{why}</p>
        </section>

        {/* assessment */}
        <section
          className="rounded-[var(--radius-card)] p-3.5"
          style={{
            background: `color-mix(in oklab, ${cat.color} 8%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${cat.color} 26%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold" style={{ color: cat.color }}>
              {assessment.categoryLabel}
            </span>
            <button
              onClick={() => onNavigate('risk')}
              className="inline-flex items-center gap-1 text-[11.5px] text-fog-500 underline-offset-2 transition hover:text-rain-300 hover:underline"
            >
              Factors <ArrowUpRight size={12} />
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog-500">
            Exploratory prioritisation from reported attributes — not a calibrated probability and not a
            statement about present conditions.
          </p>
        </section>

        {/* evidence */}
        <section>
          <h3 className="mb-2 text-[12.5px] font-semibold text-fog-100">Evidence used</h3>
          <ul className="space-y-1.5">
            {assessment.evidence.map((e) => (
              <li key={e} className="flex gap-2 text-[12.5px] leading-relaxed text-fog-300">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-rain-400" />
                {e}
              </li>
            ))}
          </ul>
        </section>

        {/* rainfall context */}
        <section className="card-quiet p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-fog-100">
            <Droplets size={13.5} className="text-rain-400" /> Rainfall context · Jun–Sep {season}
          </div>
          {seasonStat ? (
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="num text-[16px] font-semibold text-rain-300">{MM(seasonStat.totalMm)}</div>
                <div className="text-[10.5px] text-fog-600">season total</div>
              </div>
              <div>
                <div className="num text-[16px] font-semibold text-rain-300">{seasonStat.heavyDays}</div>
                <div className="text-[10.5px] text-fog-600">days ≥ 100 mm</div>
              </div>
              <div>
                <div className="num text-[16px] font-semibold text-rain-300">{MM(seasonStat.wettestMm)}</div>
                <div className="text-[10.5px] text-fog-600">wettest day</div>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-fog-500">No gauge record loaded for this season.</p>
          )}
          <p className="mt-2.5 text-[11px] leading-relaxed text-fog-600">
            City-scale gauge average across {seasonStat?.days ?? 0} days — not measured at this location.
          </p>
        </section>

        {/* provenance */}
        <section className="border-t border-white/[0.07] pt-3.5 text-[11.5px] leading-relaxed text-fog-600">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-fog-500">
            <MapPin size={12.5} /> Source & observation
          </div>
          <div className="num font-mono text-[11px] text-fog-500">
            {hotspot.lat.toFixed(4)}°N, {hotspot.lon.toFixed(4)}°E
          </div>
          <p className="mt-1.5">
            Public flood-spot inventory (Rasta Radar, MIT licence), compiled from published civic flood
            mapping. Reported fields, not measurements taken by this project.
          </p>
          <p className="mt-1.5">
            Rainfall context from the Jun–Sep {seasonStat?.season ?? season} gauge record · IMD monthly series
            1901–2021 · ward geometry DataMeet BMC wards.
          </p>
          {hotspot.sourceNote && <p className="mt-1.5 italic">“{hotspot.sourceNote}”</p>}
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card-quiet px-2.5 py-2.5 text-center">
      <div className="num text-[17px] font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-fog-600">{label}</div>
    </div>
  )
}

function buildWhy(
  h: Hotspot,
  wardCount: number,
  seasonStat: SeasonStat | null,
  season: string,
): string {
  const bits: string[] = []
  if (h.severity != null && h.severity >= 4) {
    bits.push(
      `This location carries a reported severity of ${h.severity}/5 in the public inventory — among the higher ratings in the dataset.`,
    )
  } else if (h.severity != null) {
    bits.push(`The source inventory reports a severity of ${h.severity}/5 for this location.`)
  }
  if (h.depthCm != null && h.depthCm >= 80) {
    bits.push(`Reported ponding reaches roughly ${CM(h.depthCm)}, deep enough to stop most vehicles.`)
  } else if (h.depthCm != null) {
    bits.push(`Reported ponding of about ${CM(h.depthCm)} at peak.`)
  }
  if (h.inGmc && h.ward) {
    bits.push(
      `It sits in ward ${h.ward}, which contains ${wardCount} inventoried flood-prone location${wardCount === 1 ? '' : 's'} — clustering that justifies ward-level pre-monsoon inspection.`,
    )
  } else if (!h.inGmc) {
    bits.push('It falls outside Greater Mumbai ward boundaries and is shown as regional context only.')
  }
  if (seasonStat) {
    bits.push(
      `The ${season} monsoon delivered ${MM(seasonStat.totalMm)} of city-scale rainfall, including ${seasonStat.heavyDays} day${seasonStat.heavyDays === 1 ? '' : 's'} at or above 100 mm — the kind of loading this spot is reported to struggle with.`,
    )
  }
  if (!bits.length) {
    bits.push('No reported severity or depth is available for this location; it appears in the inventory by location only.')
  }
  return bits.join(' ')
}
