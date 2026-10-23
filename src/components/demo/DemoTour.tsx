/* Guided demo tour — 90 seconds, six steps, real data and real navigation.
   No backdrop: the app stays usable, map controls stay reachable, Esc exits. */

import { ArrowLeft, ArrowRight, MousePointerClick, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { seasonStats } from '../../lib/analytics'
import { MM, severityMeta } from '../../lib/format'
import type { Route } from '../../lib/routes'
import { assess, CATEGORY_THRESHOLDS, spearman, wardHotspotCounts, WEIGHTS } from '../../lib/scoring'
import type { Dataset } from '../../lib/types'

interface TourStep {
  eyebrow: string
  title: string
  body: string
  note: string
  route: Route
  spotId?: string | null
}

export function DemoTour({
  ds,
  onNavigate,
  onSelectSpot,
  onClose,
}: {
  ds: Dataset
  onNavigate: (r: Route) => void
  onSelectSpot: (id: string | null) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const steps = useMemo<TourStep[]>(() => {
    const gmc = ds.hotspots.filter((h) => h.inGmc)
    const wardCounts = wardHotspotCounts(ds.hotspots)
    const ranked = gmc
      .map((h) => ({ h, a: assess(h, wardCounts) }))
      .sort((x, y) => y.a.score - x.a.score || (y.h.severity ?? 0) - (x.h.severity ?? 0))
    const top = ranked[0]
    const high = gmc.filter((h) => (h.severity ?? 0) >= 4).length
    const topWard = [...wardCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const seasons = seasonStats(ds.daily)
    const wettest = [...seasons].sort((a, b) => b.totalMm - a.totalMm)[0]
    const imd = ds.imd
    const jjasShare =
      imd.length > 0
        ? Math.round(
            (imd.reduce((s, r) => s + r.months[5] + r.months[6] + r.months[7] + r.months[8], 0) /
              imd.reduce((s, r) => s + r.total, 0)) *
              100,
          )
        : null
    const rho = spearman(gmc.map((h) => h.severity), gmc.map((h) => h.depthCm))

    const spot = top?.h
    const spotMeta = severityMeta(spot?.severity ?? null)

    return [
      {
        eyebrow: 'Why this exists',
        title: 'Mumbai’s waterlogging problem is knowable',
        body: `RainGuard brings three public layers together: ${gmc.length} documented flood-prone road locations inside Greater Mumbai, ${ds.wards.length} BMC ward boundaries, and ${seasons.length} complete monsoon seasons of automatic rain-gauge data.`,
        note: 'Six steps · 90 seconds · every number comes from the loaded files.',
        route: 'overview',
        spotId: null,
      },
      {
        eyebrow: 'Where it happens',
        title: 'Start with the geography',
        body: `Each marker is a reported historical hotspot, coloured by the severity stated in the public inventory. ${high} of ${gmc.length} in-city locations are reported at severity 4–5${
          topWard ? `, and ward ${topWard[0]} alone holds ${topWard[1]}` : ''
        }.`,
        note: 'Try the Points / Hotspot density switch or a ward filter — the map and counts update live.',
        route: 'explore',
        spotId: null,
      },
      {
        eyebrow: 'A real location',
        title: spot ? `Open a location: ${spot.name}` : 'Open a location',
        body: spot
          ? `Ward ${spot.ward ?? '—'} · source-reported severity ${spot.severity ?? '—'}/5 and up to ${spot.depthCm ?? '—'} cm ponding. The panel separates reported evidence from derived assessment, and shows the city-scale rainfall context — never a live road status.`
          : 'Select any marker to inspect its reported evidence, ward context and rainfall history.',
        note: spotMeta.label === 'Unrated' ? 'No severity reported by the source for this location.' : 'Reported history, not a live condition.',
        route: 'explore',
        spotId: spot?.id ?? null,
      },
      {
        eyebrow: 'The rain record',
        title: wettest ? `The ${wettest.season} monsoon is the wettest on record here` : 'The rain record',
        body: wettest
          ? `Eight Jun–Sep monsoon windows are ${ds.report?.rainfall.dailyComplete ?? 0}/${ds.report?.rainfall.expectedDays ?? 0} complete. The ${wettest.season} season totalled ${MM(
              wettest.totalMm,
            )} at city scale, with ${wettest.heavyDays} days at or above 100 mm.${
              jjasShare != null ? ` Across ${imd[0].year}–${imd[imd.length - 1].year}, June–September supplies ~${jjasShare}% of annual rainfall.` : ''
            }`
          : 'Rainfall charts render whatever public record is connected.',
        note: 'City-scale averages — this product never attributes rainfall to a single hotspot.',
        route: 'insights',
      },
      {
        eyebrow: 'The method',
        title: 'The score is explainable — and not a probability',
        body: `Prioritisation uses three reported attributes: severity (${WEIGHTS[0].weight * 100} pts), depth (${WEIGHTS[1].weight * 100} pts) and ward clustering (${WEIGHTS[2].weight * 100} pts). Bands run A ≥ ${CATEGORY_THRESHOLDS.A} down to routine watch below ${CATEGORY_THRESHOLDS.C}. Reported severity and depth agree internally (ρ = ${
          rho != null ? rho.toFixed(2) : '—'
        }), but with no dated incident log there is no accuracy claim.`,
        note: 'Expand any row to see every point accounted for.',
        route: 'risk',
      },
      {
        eyebrow: 'Judged on evidence',
        title: 'Every claim has a source — and a limit',
        body:
          'Sources, licences, cleaning rules and known limitations are all documented in the app. For residents: where the city has struggled before. For civic teams: a defensible inspection shortlist ahead of heavy rain. It is a static public snapshot, not a flood forecast.',
        note: 'Press Esc or close this card at any time — the app stays fully usable.',
        route: 'methodology',
      },
    ]
  }, [ds])

  const total = steps.length
  const step = steps[Math.min(index, total - 1)]

  const go = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(total - 1, nextIndex))
    setIndex(clamped)
    const target = steps[clamped]
    onNavigate(target.route)
    if (target.spotId !== undefined) onSelectSpot(target.spotId)
  }

  /* apply the opening step once */
  useEffect(() => {
    onNavigate(steps[0].route)
    onSelectSpot(null)
    cardRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cardRef.current?.focus()
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      const inside = cardRef.current?.contains(document.activeElement)
      if (!inside) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total])

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      tabIndex={-1}
      className="fade-up fixed inset-x-3 bottom-[calc(58px+10px)] z-[800] outline-none md:inset-x-auto md:bottom-5 md:left-[calc(50%+36px)] md:w-[540px] md:-translate-x-1/2"
    >
      <div className="overflow-hidden rounded-[16px] border border-rain-400/25 bg-ink-850/95 shadow-[0_28px_60px_-20px_rgba(2,6,20,0.85)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <Sparkles size={13} className="text-rain-300" />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rain-300">
            Guided tour · {index + 1} of {total}
          </span>
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-fog-600 sm:flex">
            <MousePointerClick size={11} /> interactive
          </span>
          <button
            onClick={onClose}
            aria-label="Close guided tour"
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-fog-500 transition hover:border-white/25 hover:text-fog-100"
          >
            <X size={13.5} />
          </button>
        </div>

        <div key={step.title} className="fade-up px-5 pb-4 pt-4">
          <div className="eyebrow mb-1.5">{step.eyebrow}</div>
          <h2 id="tour-title" className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fog-100">
            {step.title}
          </h2>
          <p id="tour-body" aria-live="polite" className="mt-2 text-[12.5px] leading-relaxed text-fog-300">
            {step.body}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-fog-600">{step.note}</p>
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Tour progress">
            {steps.map((s, i) => (
              <button
                key={s.title}
                onClick={() => go(i)}
                aria-label={`Go to step ${i + 1}: ${s.eyebrow}`}
                aria-current={i === index ? 'step' : undefined}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 18 : 6,
                  background: i === index ? '#6fd2f7' : i < index ? 'rgba(56,188,242,0.55)' : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>
          <span className="hidden text-[10.5px] text-fog-600 sm:block">Esc closes · arrow keys move</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost h-8 px-3" onClick={() => go(index - 1)} disabled={index === 0} style={index === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
              <ArrowLeft size={13} /> Back
            </button>
            {index < total - 1 ? (
              <button className="btn-primary h-8 px-3.5 text-[12.5px]" onClick={() => go(index + 1)}>
                Next <ArrowRight size={13} />
              </button>
            ) : (
              <button className="btn-primary h-8 px-3.5 text-[12.5px]" onClick={onClose}>
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
