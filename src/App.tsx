import { useEffect, useState } from 'react'
import { dataFreshness } from './lib/analytics'
import { loadDataset } from './lib/data'
import { routeFromHash, writeHash, type Route } from './lib/routes'
import type { Dataset } from './lib/types'
import { LogoMark, Shell } from './components/shell/Shell'
import { DemoTour } from './components/demo/DemoTour'
import { Skeleton } from './components/ui/bits'
import { Overview } from './pages/Overview'
import { Explore } from './pages/Explore'
import { Insights } from './pages/Insights'
import { Risk } from './pages/Risk'
import { Methodology } from './pages/Methodology'

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(900px 460px at 70% 0%, rgba(19,157,217,0.18), transparent 62%)' }}
      />
      <div className="relative w-[min(440px,88vw)] text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-ink-850">
          <LogoMark size={40} />
        </div>
        <div className="display text-[22px] text-fog-100">
          CityPulse <span className="text-rain-400">RainGuard</span>
        </div>
        <p className="mt-2 text-[13px] text-fog-500">
          Loading Mumbai ward boundaries, hotspot inventory and rainfall records…
        </p>
        <div className="mt-7 space-y-3 text-left">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? 'overview' : routeFromHash(),
  )
  const [data, setData] = useState<Dataset | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tourOpen, setTourOpen] = useState(false)

  useEffect(() => {
    let alive = true
    loadDataset()
      .then((ds) => alive && setData(ds))
      .catch(() =>
        alive &&
        setData({
          hotspots: [],
          wards: [],
          daily: [],
          imd: [],
          stations: [],
          report: null,
          failures: ['all'],
        }),
      )
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => {
      alive = false
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  useEffect(() => {
    if (!data) return
    const report = data.report
    if (!report) return
    const endYear = Math.max(
      report.rainfall.dailyEnd ? Number(report.rainfall.dailyEnd.slice(0, 4)) : 0,
      report.imdMonthly.endYear,
    )
    if (endYear <= 2024 && data.failures.length === 0) {
      setTourOpen(true)
    }
  }, [data])

  const navigate = (r: Route) => {
    writeHash(r)
    setRoute(r)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const openSpot = (id: string) => {
    setSelectedId(id)
    navigate('explore')
  }

  if (!data) return <LoadingScreen />

  const freshness = dataFreshness(data).value

  return (
    <>
    <Shell route={route} onNavigate={navigate} onStartTour={() => setTourOpen(true)} freshness={freshness}>
      {route === 'overview' && (
        <Overview ds={data} onNavigate={navigate} onOpenSpot={openSpot} onStartTour={() => setTourOpen(true)} />
      )}
      {route === 'explore' && (
        <Explore
          ds={data}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNavigate={navigate}
          tourActive={tourOpen}
        />
      )}
      {route === 'insights' && <Insights ds={data} />}
      {route === 'risk' && <Risk ds={data} onOpenSpot={openSpot} />}
      {route === 'methodology' && <Methodology ds={data} onNavigate={navigate} />}
    </Shell>
    {tourOpen && (
      <DemoTour
        ds={data}
        onNavigate={navigate}
        onSelectSpot={setSelectedId}
        onClose={() => setTourOpen(false)}
      />
    )}
    </>
  )
}
