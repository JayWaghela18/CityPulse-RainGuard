/* Shared chart primitives so every visualisation speaks the same language. */

import type { ReactNode } from 'react'
import { ResponsiveContainer, Tooltip } from 'recharts'

export const AXIS_TICK = { fill: '#617194', fontSize: 11, fontFamily: 'Inter' }
export const GRID = 'rgba(255,255,255,0.06)'
export const RAIN = '#38bcf2'
export const RAIN_DEEP = '#139dd9'
export const TEAL = '#2fd4a8'
export const AMBER = '#f5a524'
export const CORAL = '#f45c4a'

export interface TipPayloadItem {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

export function DarkTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean
  payload?: TipPayloadItem[]
  label?: string | number
  formatter?: (v: number, name: string | number) => string
  labelFormatter?: (label: string | number | undefined, payload?: TipPayloadItem[]) => string
}) {
  if (!active || !payload?.length) return null
  const shownLabel = labelFormatter ? labelFormatter(label, payload) : label
  return (
    <div className="rounded-[10px] border border-white/12 bg-ink-850/95 px-3 py-2 shadow-[var(--shadow-float)] backdrop-blur">
      {shownLabel != null && shownLabel !== '' && (
        <div className="mb-1 text-[11px] font-semibold text-fog-300">{shownLabel}</div>
      )}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-[12px] text-fog-100">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? RAIN }} />
            <span className="text-fog-500">{p.name}</span>
            <span className="num ml-auto font-semibold">
              {formatter && typeof p.value === 'number'
                ? formatter(p.value, p.name ?? '')
                : String(p.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChartShell({
  title,
  sub,
  meta,
  height = 240,
  children,
  action,
}: {
  title: string
  sub?: string
  meta?: string
  height?: number
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="panel flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[14.5px] font-semibold text-fog-100">{title}</h3>
          {sub && <p className="mt-1 text-[12px] leading-relaxed text-fog-500">{sub}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
      {meta && <p className="mt-3 text-[11px] leading-relaxed text-fog-600">{meta}</p>}
    </section>
  )
}

export function ChartTooltip({
  formatter,
  labelFormatter,
  cursorFill = 'rgba(255,255,255,0.04)',
}: {
  formatter?: (v: number, name: string | number) => string
  labelFormatter?: (label: string | number | undefined, payload?: TipPayloadItem[]) => string
  cursorFill?: string
}) {
  return (
    <Tooltip
      content={<DarkTooltip formatter={formatter} labelFormatter={labelFormatter} />}
      cursor={{ fill: cursorFill }}
    />
  )
}
