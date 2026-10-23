import { BookOpen, ChartColumn, LayoutGrid, Map, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Route } from '../../lib/routes'
import { ROUTES } from '../../lib/routes'

const ICONS: Record<Route, typeof LayoutGrid> = {
  overview: LayoutGrid,
  explore: Map,
  insights: ChartColumn,
  risk: ShieldCheck,
  methodology: BookOpen,
}

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id="cp-drop" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#139dd9" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#0a142f" stroke="rgba(120,190,240,0.35)" />
      <path
        d="M20 8.5c4.6 5.4 8 9.6 8 13.7a8 8 0 1 1-16 0c0-4.1 3.4-8.3 8-13.7Z"
        fill="url(#cp-drop)"
        opacity="0.92"
      />
      <path d="M9 27.5h5.5l2.6-4.6 3.2 8 3-5.4 1.9 2H31" stroke="#2fd4a8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function NavItems({
  route,
  onNavigate,
  variant,
}: {
  route: Route
  onNavigate: (r: Route) => void
  variant: 'rail' | 'bar'
}) {
  return (
    <>
      {ROUTES.map((r) => {
        const Icon = ICONS[r.id]
        const active = route === r.id
        if (variant === 'rail') {
          return (
            <button
              key={r.id}
              className="rail-btn group"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              aria-label={r.label}
              onClick={() => onNavigate(r.id)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span className="pointer-events-none absolute left-[54px] z-50 hidden whitespace-nowrap rounded-lg border border-white/10 bg-ink-850 px-2.5 py-1.5 text-[12px] font-medium text-fog-100 shadow-[var(--shadow-float)] group-hover:block">
                {r.label}
              </span>
            </button>
          )
        }
        return (
          <button
            key={r.id}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors"
            data-active={active}
            aria-current={active ? 'page' : undefined}
            style={{
              color: active ? '#6fd2f7' : '#7d8db1',
              background: active ? 'rgba(56,188,242,0.1)' : 'transparent',
            }}
            onClick={() => onNavigate(r.id)}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span className="text-[10px] font-semibold tracking-wide">{r.short}</span>
          </button>
        )
      })}
    </>
  )
}

export function Shell({
  route,
  onNavigate,
  onStartTour,
  freshness,
  children,
}: {
  route: Route
  onNavigate: (r: Route) => void
  onStartTour: () => void
  freshness: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-ink-950">
      {/* atmospheric wash */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(1100px 520px at 78% -8%, rgba(19,157,217,0.16), transparent 60%), radial-gradient(900px 480px at 6% 108%, rgba(47,212,168,0.08), transparent 60%)',
        }}
      />

      {/* top bar */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 pl-3 pr-3 sm:pl-4 sm:pr-5">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-[-0.02em] text-fog-100">
                CityPulse <span className="text-rain-400">RainGuard</span>
              </div>
              <div className="mt-1 hidden text-[10.5px] font-medium tracking-[0.16em] text-fog-600 uppercase sm:block">
                Mumbai Monsoon Intelligence
              </div>
            </div>
          </div>

          <div className="mx-2 hidden h-6 w-px bg-white/10 md:block" />

          <div className="hidden items-center gap-1.5 text-[12.5px] text-fog-300 md:flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Mumbai, India
            <span className="text-fog-600">· 19.07°N, 72.87°E</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onStartTour}
              className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-rain-400/30 bg-rain-400/[0.08] px-2.5 text-[11.5px] font-semibold text-rain-200 transition hover:border-rain-400/60 hover:bg-rain-400/15 sm:px-3"
              aria-label="Start the 90-second guided tour"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Demo tour</span>
            </button>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-soft opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-soft" />
              </span>
              <span className="hidden text-[11.5px] text-fog-500 sm:inline">Observations through</span>
              <span className="text-[11.5px] font-semibold text-fog-100">{freshness}</span>
            </div>
          </div>
        </div>
      </header>

      {/* desktop rail */}
      <nav
        aria-label="Primary"
        className="fixed left-0 top-14 bottom-0 z-40 hidden w-[72px] flex-col items-center gap-1.5 border-r border-white/[0.07] bg-ink-900/70 py-4 backdrop-blur-xl md:flex"
      >
        <div className="group flex flex-col items-center gap-1.5">
          <NavItems route={route} onNavigate={onNavigate} variant="rail" />
        </div>
        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="h-px w-8 bg-white/10" />
          <span className="text-[9.5px] font-semibold tracking-widest text-fog-600">V1.0</span>
        </div>
      </nav>

      {/* content */}
      <main className="relative z-10 pt-14 md:pl-[72px]">
        <div className="pb-24 md:pb-0">{children}</div>
      </main>

      {/* mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-white/10 bg-ink-900/95 px-2 py-2 backdrop-blur-xl md:hidden"
      >
        <NavItems route={route} onNavigate={onNavigate} variant="bar" />
      </nav>
    </div>
  )
}
