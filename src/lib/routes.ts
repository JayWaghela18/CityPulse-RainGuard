/* Tiny hash-based router — no extra dependency, shareable URLs. */

export type Route = 'overview' | 'explore' | 'insights' | 'risk' | 'methodology'

export const ROUTES: { id: Route; label: string; short: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Home' },
  { id: 'explore', label: 'Explore Map', short: 'Map' },
  { id: 'insights', label: 'Rainfall & Insights', short: 'Charts' },
  { id: 'risk', label: 'Risk Assessment', short: 'Risk' },
  { id: 'methodology', label: 'Methodology & Data', short: 'Method' },
]

export const isRoute = (v: string): v is Route => ROUTES.some((r) => r.id === v)

export function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return isRoute(hash) ? hash : 'overview'
}

export function writeHash(route: Route) {
  const next = `#/${route}`
  if (window.location.hash !== next) window.location.hash = next
}
