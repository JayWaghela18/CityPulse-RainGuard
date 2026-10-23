/* Formatting helpers — units, dates, numbers. */

export const MM = (v: number, digits = 0) =>
  `${v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })} mm`

export const CM = (v: number) => `${v.toLocaleString('en-US')} cm`

export const NUM = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { maximumFractionDigits: digits })

export const PCT = (v: number) => `${Math.round(v)}%`

/** Compact counts for headlines: 3,466,715 -> 3.47M. */
export const COMPACT = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : v >= 10_000
      ? `${Math.round(v / 1000)}k`
      : NUM(v)

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const monthLabel = (i: number) => MONTHS[i] ?? ''

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d} ${monthLabel(Number(m) - 1)} ${y}`
}

export const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d} ${monthLabel(Number(m) - 1)}`
}

export const monthYear = (iso: string) => {
  const [y, m] = iso.split('-')
  return `${monthLabel(Number(m) - 1)} ${y}`
}

/** Severity -> stable display token used identically on map, charts and panels. */
export const SEVERITY_META: Record<number, { label: string; color: string; tint: string }> = {
  1: { label: 'Low', color: '#2fd4a8', tint: 'rgba(47,212,168,0.16)' },
  2: { label: 'Lower', color: '#2fd4a8', tint: 'rgba(47,212,168,0.16)' },
  3: { label: 'Moderate', color: '#f5a524', tint: 'rgba(245,165,36,0.16)' },
  4: { label: 'High', color: '#fb7d67', tint: 'rgba(251,125,103,0.16)' },
  5: { label: 'Severe', color: '#f45c4a', tint: 'rgba(244,92,74,0.2)' },
}

export const severityMeta = (s: number | null) =>
  s != null ? (SEVERITY_META[s] ?? SEVERITY_META[3]) : { label: 'Unrated', color: '#7d8db1', tint: 'rgba(125,141,177,0.16)' }
