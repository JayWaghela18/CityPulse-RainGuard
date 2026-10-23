import { SEVERITY_META } from '../../lib/format'
import type { MapMode } from './MumbaiMap'

/** Map legend — the single source of the severity colour language. */
export function MapLegend({ mode = 'points', className = '' }: { mode?: MapMode; className?: string }) {
  const entries = [
    { meta: SEVERITY_META[5], label: '5 · Severe (reported)' },
    { meta: SEVERITY_META[4], label: '4 · High (reported)' },
    { meta: SEVERITY_META[3], label: '3 · Moderate (reported)' },
    { meta: SEVERITY_META[2], label: '2 · Lower (reported)' },
  ]
  return (
    <div
      className={`pointer-events-none absolute bottom-3 left-3 z-[500] rounded-[12px] border border-white/10 bg-ink-850/90 px-3.5 py-3 backdrop-blur-md ${className}`}
    >
      <div className="eyebrow mb-2 text-[9.5px]">Legend</div>
      {mode === 'density' ? (
        <div className="flex items-center gap-2.5">
          <div
            className="h-2.5 w-28 rounded-full"
            style={{ background: 'linear-gradient(90deg,#2fd4a8,#f5a524,#f45c4a)' }}
          />
          <span className="text-[11px] text-fog-500">lower → higher concentration</span>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.label} className="flex items-center gap-2.5 text-[11px] text-fog-300">
              <span
                className="h-[9px] w-[9px] rounded-full"
                style={{ background: e.meta.color, boxShadow: `0 0 0 2px ${e.meta.color}44` }}
              />
              {e.label}
            </li>
          ))}
        </ul>
      )}
      <div className="my-2 h-px bg-white/10" />
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2.5 text-[11px] text-fog-300">
          <svg width="18" height="8" aria-hidden>
            <line x1="0" y1="4" x2="18" y2="4" stroke="#5aa9e6" strokeWidth="1.2" strokeDasharray="4 5" />
          </svg>
          BMC ward boundary
        </li>
        <li className="flex items-center gap-2.5 text-[11px] text-fog-300">
          <span className="h-[9px] w-[9px] rounded-full border-2 border-ink-950 bg-fog-500" />
          Outside Greater Mumbai
        </li>
      </ul>
    </div>
  )
}
