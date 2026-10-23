import type { ReactNode } from 'react'
import type { Finding, Kpi } from '../../lib/analytics'

const TONE: Record<string, string> = {
  rain: '#38bcf2',
  teal: '#2fd4a8',
  amber: '#f5a524',
  coral: '#f45c4a',
}

export function Badge({
  children,
  color = '#b3c1dd',
  filled = false,
}: {
  children: ReactNode
  color?: string
  filled?: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-wide"
      style={
        filled
          ? { background: color, color: '#06101d' }
          : { background: `color-mix(in oklab, ${color} 15%, transparent)`, color, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 40%, transparent)` }
      }
    >
      {children}
    </span>
  )
}

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const tone = TONE[kpi.tone] ?? TONE.rain
  return (
    <div className="panel relative overflow-hidden px-5 py-4">
      <span
        className="absolute left-0 top-4 h-9 w-[3px] rounded-r"
        style={{ background: tone, boxShadow: `0 0 14px ${tone}` }}
      />
      <div className="display num text-[30px] leading-none" style={{ color: tone }}>
        {kpi.value}
      </div>
      <div className="mt-2 text-[13px] font-semibold text-fog-100">{kpi.label}</div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-fog-500">{kpi.sub}</div>
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string
  title: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2 className="display text-[24px] text-fog-100 sm:text-[28px]">{title}</h2>
        {sub && <p className="mt-2 text-[13.5px] leading-relaxed text-fog-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-white/12 bg-white/[0.02] px-6 text-center ${
        compact ? 'py-8' : 'py-16'
      }`}
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-fog-500">
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-fog-100">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-fog-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const tone = TONE[finding.tone] ?? TONE.rain
  return (
    <article
      className="fade-up card-quiet group relative overflow-hidden p-5 transition-colors duration-200 hover:border-white/20"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${tone}, transparent 65%)` }} />
      <div className="flex items-start justify-between gap-4">
        <span className="eyebrow" style={{ color: tone }}>
          {finding.eyebrow}
        </span>
        {finding.metric && (
          <span className="num shrink-0 text-[13px] font-semibold" style={{ color: tone }}>
            {finding.metric}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 text-[15.5px] font-semibold leading-snug text-fog-100">{finding.title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-fog-500">{finding.body}</p>
    </article>
  )
}

export function Callout({
  tone = 'rain',
  icon,
  title,
  children,
}: {
  tone?: 'rain' | 'teal' | 'amber' | 'coral'
  icon?: ReactNode
  title: string
  children: ReactNode
}) {
  const color = TONE[tone] ?? TONE.rain
  return (
    <div
      className="flex gap-3 rounded-[var(--radius-card)] p-4"
      style={{ background: `color-mix(in oklab, ${color} 8%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 24%, transparent)` }}
    >
      {icon && <div className="mt-0.5 shrink-0" style={{ color }}>{icon}</div>}
      <div className="text-[12.5px] leading-relaxed text-fog-300">
        <span className="font-semibold" style={{ color }}>
          {title}
        </span>{' '}
        {children}
      </div>
    </div>
  )
}
