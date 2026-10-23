import { ArrowUpRight, ChevronDown, CircleAlert, Database, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  assess,
  CATEGORY_META,
  CATEGORY_THRESHOLDS,
  spearman,
  wardHotspotCounts,
  WEIGHTS,
  type Assessment,
} from '../lib/scoring'
import { CM, MM, severityMeta } from '../lib/format'
import { seasonStats } from '../lib/analytics'
import { wardStats } from '../lib/analytics'
import type { Hotspot } from '../lib/types'
import type { Dataset } from '../lib/types'
import { Badge, Callout, EmptyState, SectionHeader } from '../components/ui/bits'

const CATEGORIES: Assessment['category'][] = ['A', 'B', 'C', 'Monitor']

export function Risk({ ds, onOpenSpot }: { ds: Dataset; onOpenSpot: (id: string) => void }) {
  const [ward, setWard] = useState('all')
  const [category, setCategory] = useState<'all' | Assessment['category']>('all')
  const [scope, setScope] = useState<'gmc' | 'all'>('gmc')
  const [expanded, setExpanded] = useState<string | null>(null)

  const wardCounts = useMemo(() => wardHotspotCounts(ds.hotspots), [ds.hotspots])
  const wards = useMemo(() => wardStats(ds.hotspots), [ds.hotspots])
  const rows = useMemo(() => {
    return ds.hotspots
      .map((h) => ({ h, a: assess(h, wardCounts) }))
      .sort((x, y) => y.a.score - x.a.score || (y.h.severity ?? 0) - (x.h.severity ?? 0))
  }, [ds.hotspots, wardCounts])

  const scoped = rows.filter(({ h }) => scope === 'all' || h.inGmc)
  const filtered = scoped.filter(({ h, a }) => {
    if (ward !== 'all' && h.ward !== ward) return false
    if (category !== 'all' && a.category !== category) return false
    return true
  })

  const gmc = ds.hotspots.filter((h) => h.inGmc)
  const labelled = gmc.filter((h) => h.severity != null && h.depthCm != null)
  const rho = spearman(gmc.map((h) => h.severity), gmc.map((h) => h.depthCm))
  const completeness = gmc.length ? Math.round((labelled.length / gmc.length) * 100) : 0
  const seasons = seasonStats(ds.daily)
  const latestSeason = seasons.length ? seasons[seasons.length - 1] : null
  const catCounts = scoped.reduce<Record<string, number>>((acc, { a }) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <SectionHeader
        eyebrow="Risk assessment"
        title="An explainable read on where to inspect first"
        sub="A transparent prioritisation of inventoried locations built from three reported attributes. It is explicitly exploratory: it does not claim to predict flooding, and no accuracy figure is reported because no labelled incident dataset exists to validate against."
      />

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        {/* ---------------------------- method card --------------------------- */}
        <section className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-fog-100">How the score is built</h2>
            <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-400">
              Exploratory · not a probability
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fog-500">
            Each location receives 0–100 points from three weighted, reported attributes. The weighting is a
            documented judgement call designed for inspection planning — not a fitted statistical model.
          </p>
          <div className="mt-4 space-y-3">
            {WEIGHTS.map((w) => (
              <div key={w.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] font-medium text-fog-100">{w.label}</span>
                  <span className="num text-[12px] text-fog-500">{Math.round(w.weight * 100)} pts max</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${w.weight * 100}%`,
                      background:
                        w.key === 'severity'
                          ? 'linear-gradient(90deg,#f45c4a,#fb7d67)'
                          : w.key === 'depth'
                            ? 'linear-gradient(90deg,#139dd9,#38bcf2)'
                            : 'linear-gradient(90deg,#17a986,#2fd4a8)',
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-fog-600">{w.description}</p>
              </div>
            ))}
          </div>
          <div className="hairline my-4" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c]
              return (
                <div key={c} className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: meta.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                    {c === 'Monitor' ? 'Watch' : `Priority ${c}`}
                  </div>
                  <div className="num mt-0.5 text-[15px] font-semibold text-fog-100">
                    {catCounts[c] ?? 0}
                    <span className="ml-1 text-[10.5px] font-normal text-fog-600">locations</span>
                  </div>
                </div>
              )
            }            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fog-600">
            Bands: Priority A ≥ {CATEGORY_THRESHOLDS.A}, B {CATEGORY_THRESHOLDS.B}–{CATEGORY_THRESHOLDS.A - 1},
            C {CATEGORY_THRESHOLDS.C}–{CATEGORY_THRESHOLDS.B - 1}, routine watch below{' '}
            {CATEGORY_THRESHOLDS.C}. Thresholds are planning conventions, not statistical cut points.
          </p>
        </section>

        {/* --------------------------- validation card ------------------------ */}
        <section className="panel p-5">
          <h2 className="text-[15px] font-semibold text-fog-100">Validation status</h2>
          <div className="mt-3 space-y-2.5">
            <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-fog-600">Internal consistency</div>
              <div className="num mt-1 text-[22px] font-semibold text-fog-100">
                ρ = {rho != null ? rho.toFixed(2) : '—'}
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog-500">
                Spearman rank correlation between reported severity and reported depth across{' '}
                {labelled.length} Greater Mumbai records. This measures agreement{' '}
                <em>inside</em> the inventory — it is not predictive accuracy.
              </p>
            </div>
            <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-fog-600">Attribute completeness</div>
              <div className="num mt-1 text-[22px] font-semibold text-fog-100">{completeness}%</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog-500">
                Share of Greater Mumbai records carrying both a severity rating and a reported depth. Missing
                attributes contribute zero points rather than an imputed guess.
              </p>
            </div>
            <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-fog-600">External validation</div>
              <div className="mt-1 text-[13px] font-semibold text-amber-400">Not possible with public data</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog-500">
                No verified, dated incident log could be obtained. Until one is, this page will never show an
                accuracy, precision or recall figure.
              </p>
            </div>
          </div>
          <Callout tone="amber" icon={<TriangleAlert size={15} />} title="Not live conditions.">
            Nothing here says a road is flooded now, and absence from this list is never a safety statement.
          </Callout>
        </section>
      </div>

      {/* ------------------------------- list -------------------------------- */}
      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge color="#38bcf2">Reported by source: location, severity, depth</Badge>
          <Badge color="#f5a524">Derived here: score, priority band</Badge>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-[16px] font-semibold text-fog-100">Prioritised locations</h2>
          <span className="text-[12px] text-fog-600">{filtered.length} shown</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              className="field min-w-[150px]"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'gmc' | 'all')}
              aria-label="Geographic scope"
            >
              <option value="gmc">Greater Mumbai only</option>
              <option value="all">All regional records</option>
            </select>
            <select className="field min-w-[130px]" value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Filter by ward">
              <option value="all">All wards</option>
              {wards.map((w) => (
                <option key={w.ward} value={w.ward}>
                  Ward {w.ward}
                </option>
              ))}
            </select>
            <select
              className="field min-w-[150px]"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              aria-label="Filter by priority band"
            >
              <option value="all">All priority bands</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!ds.hotspots.length ? (
          <EmptyState
            icon={<Database size={22} />}
            title="No hotspot inventory connected"
            body="The assessment needs the public flood-spot inventory. Add public/data/hotspots.json and run scripts/prepare_data.py to generate ward assignments."
          />
        ) : (
          <div className="panel overflow-hidden">
            <div className="hidden items-center gap-3 border-b border-white/[0.07] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fog-600 md:flex">
              <span className="w-7">#</span>
              <span className="flex-1">Location</span>
              <span className="w-16 text-center">Ward</span>
              <span className="w-16 text-center">Severity</span>
              <span className="w-20 text-center">Depth</span>
              <span className="w-24 text-center">Score</span>
              <span className="w-[168px]">Band</span>
              <span className="w-5" />
            </div>
            {filtered.map(({ h, a }, i) => (
              <Row
                key={h.id}
                index={i + 1}
                h={h}
                a={a}
                open={expanded === h.id}
                onToggle={() => setExpanded(expanded === h.id ? null : h.id)}
                onOpenSpot={onOpenSpot}
                seasonLabel={latestSeason ? `Jun–Sep ${latestSeason.season}` : null}
                seasonTotal={latestSeason?.totalMm ?? null}
              />
            ))}
            {!filtered.length && (
              <div className="px-5 py-10 text-center text-[13px] text-fog-500">
                No locations match this filter.
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Callout tone="rain" icon={<CircleAlert size={16} />} title="Historical hotspot ≠ prediction.">
          Severity and depth are reported attributes of a public inventory compiled from published civic flood
          mapping. Treat the ranking as a checklist for inspection, not a forecast of which road will flood.
        </Callout>
        <Callout tone="teal" icon={<ShieldCheck size={16} />} title="No “safe” label exists in this product.">
          A location without a high score has not been assessed as safe. It simply carries lower reported
          evidence in the inventory available to us.
        </Callout>
      </div>
    </div>
  )
}

function Row({
  index,
  h,
  a,
  open,
  onToggle,
  onOpenSpot,
  seasonLabel,
  seasonTotal,
}: {
  index: number
  h: Hotspot
  a: Assessment
  open: boolean
  onToggle: () => void
  onOpenSpot: (id: string) => void
  seasonLabel: string | null
  seasonTotal: number | null
}) {
  const cat = CATEGORY_META[a.category]
  const meta = severityMeta(h.severity)
  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] md:flex-nowrap"
      >
        <span className="num hidden w-7 text-[12px] text-fog-600 md:block">{index}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-fog-100">{h.name}</span>
          <span className="block truncate text-[11.5px] text-fog-600">
            {h.area ?? 'Mumbai'}
            {h.ward ? ` · Ward ${h.ward}` : ' · outside BMC wards'}
          </span>
        </span>
        <span className="hidden w-16 text-center text-[12px] text-fog-400 md:block">{h.ward ?? '—'}</span>
        <span className="w-16 text-center">
          <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: meta.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            {h.severity != null ? `${h.severity}/5` : '—'}
          </span>
        </span>
        <span className="num hidden w-20 text-center text-[12px] text-fog-300 md:block">
          {h.depthCm != null ? CM(h.depthCm) : '—'}
        </span>
        <span className="num w-24 text-center text-[13px] font-semibold" style={{ color: cat.color }}>
          {a.score}
          <span className="text-[10.5px] font-normal text-fog-600">/100</span>
        </span>
        <span className="hidden w-[168px] md:block">
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ background: `color-mix(in oklab, ${cat.color} 16%, transparent)`, color: cat.color }}
          >
            {a.category === 'Monitor' ? 'Routine watch' : `Priority ${a.category}`}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`ml-auto shrink-0 text-fog-600 transition-transform md:ml-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="fade-up border-t border-white/[0.05] bg-ink-950/40 px-4 py-4 md:pl-[44px]">
          <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="eyebrow mb-2">Score composition</div>
              {a.contributions.map((c) => (
                <div key={c.key} className="mb-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="text-fog-300">{c.label}</span>
                    <span className="num text-fog-500">
                      <span className="font-semibold text-fog-100">{c.points.toFixed(1)}</span> / {c.maxPoints}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(c.points / c.maxPoints) * 100}%`, background: cat.color }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-fog-600">{c.detail}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="eyebrow mb-2">Evidence & context</div>
              <ul className="space-y-1.5">
                {a.evidence.map((e) => (
                  <li key={e} className="flex gap-2 text-[12px] leading-relaxed text-fog-300">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-rain-400" />
                    {e}
                  </li>
                ))}
                {seasonLabel && seasonTotal != null && (
                  <li className="flex gap-2 text-[12px] leading-relaxed text-fog-300">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal-soft" />
                    City-scale rainfall context: {MM(seasonTotal)} across {seasonLabel} (not location-specific).
                  </li>
                )}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => onOpenSpot(h.id)}>
                  Inspect on map <ArrowUpRight size={13} />
                </button>
                <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-fog-600">
                  {cat.blurb}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
