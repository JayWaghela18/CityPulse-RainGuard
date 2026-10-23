/* Explainable historical-hotspot prioritisation.
   IMPORTANT: this is an exploratory ranking built from reported attributes of a
   public flood-spot inventory — it is NOT a calibrated probability and NOT a
   validated flood-prediction model. No labelled incident dataset exists to train
   or validate one; see the Methodology page. */

import type { Hotspot } from './types'

export interface Weight {
  key: 'severity' | 'depth' | 'density'
  label: string
  weight: number
  description: string
}

export const WEIGHTS: Weight[] = [
  {
    key: 'severity',
    label: 'Reported severity',
    weight: 0.5,
    description: 'Source inventory severity rating, normalised over the 1-5 scale.',
  },
  {
    key: 'depth',
    label: 'Reported ponding depth',
    weight: 0.3,
    description: 'Reported maximum depth in cm, normalised against 150 cm (capped).',
  },
  {
    key: 'density',
    label: 'Ward clustering',
    weight: 0.2,
    description: 'Share of the ward’s inventoried hotspots relative to the densest ward.',
  },
]

export const DEPTH_NORMALISER_CM = 150

/** Score bands used to translate the number into an inspection priority. */
export const CATEGORY_THRESHOLDS = { A: 70, B: 55, C: 40 } as const

export const MAX_SCORE = 100

export interface Assessment {
  id: string
  score: number
  category: 'A' | 'B' | 'C' | 'Monitor'
  categoryLabel: string
  contributions: { key: Weight['key']; label: string; points: number; maxPoints: number; detail: string }[]
  evidence: string[]
  wardCount: number
}

export const categoryFor = (score: number): Assessment['category'] =>
  score >= CATEGORY_THRESHOLDS.A
    ? 'A'
    : score >= CATEGORY_THRESHOLDS.B
      ? 'B'
      : score >= CATEGORY_THRESHOLDS.C
        ? 'C'
        : 'Monitor'

export const CATEGORY_META: Record<Assessment['category'], { label: string; color: string; blurb: string }> = {
  A: { label: 'Priority A · inspect first', color: '#f45c4a', blurb: 'Highest combined reported severity, depth and ward clustering.' },
  B: { label: 'Priority B · plan inspection', color: '#fb7d67', blurb: 'Strong reported evidence; schedule checks before peak monsoon.' },
  C: { label: 'Priority C · monitor', color: '#f5a524', blurb: 'Notable reported history; monitor during heavy rainfall spells.' },
  Monitor: { label: 'Routine watch', color: '#2fd4a8', blurb: 'Lower reported evidence in the inventory — not a statement of safety.' },
}

export function wardHotspotCounts(hotspots: Hotspot[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const h of hotspots) {
    if (!h.inGmc || !h.ward) continue
    counts.set(h.ward, (counts.get(h.ward) ?? 0) + 1)
  }
  return counts
}

export function assess(hotspot: Hotspot, wardCounts: Map<string, number>): Assessment {
  const maxWard = Math.max(1, ...wardCounts.values())
  const sev = hotspot.severity ?? 0
  const depth = hotspot.depthCm ?? 0
  const wardCount = hotspot.ward ? (wardCounts.get(hotspot.ward) ?? 0) : 0

  const severityNorm = Math.min(sev / 5, 1)
  const depthNorm = Math.min(depth / DEPTH_NORMALISER_CM, 1)
  const densityNorm = hotspot.inGmc ? wardCount / maxWard : 0

  const contributions = [
    {
      key: 'severity' as const,
      label: WEIGHTS[0].label,
      points: severityNorm * WEIGHTS[0].weight * 100,
      maxPoints: WEIGHTS[0].weight * 100,
      detail: hotspot.severity != null ? `Reported severity ${sev}/5` : 'No severity reported in source',
    },
    {
      key: 'depth' as const,
      label: WEIGHTS[1].label,
      points: depthNorm * WEIGHTS[1].weight * 100,
      maxPoints: WEIGHTS[1].weight * 100,
      detail: hotspot.depthCm != null ? `Reported ${depth} cm ponding` : 'No depth reported in source',
    },
    {
      key: 'density' as const,
      label: WEIGHTS[2].label,
      points: densityNorm * WEIGHTS[2].weight * 100,
      maxPoints: WEIGHTS[2].weight * 100,
      detail: hotspot.inGmc ? `${wardCount} inventoried spot${wardCount === 1 ? '' : 's'} in ward ${hotspot.ward}` : 'Outside Greater Mumbai wards',
    },
  ]

  const score = Math.round(contributions.reduce((sum, c) => sum + c.points, 0))
  const category = categoryFor(score)

  const evidence: string[] = []
  if (hotspot.severity != null) evidence.push(`Reported severity ${sev}/5 in the source inventory`)
  if (hotspot.depthCm != null) evidence.push(`Reported ponding depth up to ${depth} cm`)
  if (hotspot.inGmc && hotspot.ward) evidence.push(`Located inside ward ${hotspot.ward} (${wardCount} inventoried spots)`)
  if (hotspot.sourceNote) evidence.push(`Source note: ${hotspot.sourceNote}`)
  if (!hotspot.inGmc) evidence.push('Outside Greater Mumbai (BMC) boundaries — regional context only')

  return {
    id: hotspot.id,
    score,
    category,
    categoryLabel: CATEGORY_META[category].label,
    contributions,
    evidence,
    wardCount,
  }
}

/** Spearman rank correlation — internal-consistency check between the two
    reported numeric fields. Measures agreement inside the inventory, NOT
    predictive accuracy against observed flooding. */
export function spearman(xs: (number | null)[], ys: (number | null)[]): number | null {
  const pairs: [number, number][] = []
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null) pairs.push([xs[i] as number, ys[i] as number])
  }
  const n = pairs.length
  if (n < 3) return null

  const rank = (vals: number[]): number[] => {
    const idx = vals.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0])
    const out = new Array<number>(vals.length).fill(0)
    let i = 0
    while (i < idx.length) {
      let j = i
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
      const avg = (i + j) / 2 + 1
      for (let k = i; k <= j; k++) out[idx[k][1]] = avg
      i = j + 1
    }
    return out
  }

  const rx = rank(pairs.map((p) => p[0]))
  const ry = rank(pairs.map((p) => p[1]))
  const mx = rx.reduce((a, b) => a + b, 0) / n
  const my = ry.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? null : num / den
}
