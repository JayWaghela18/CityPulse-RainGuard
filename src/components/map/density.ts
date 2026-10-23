/* A small custom density ("heat") layer for Leaflet — drawn on canvas with no
   plugin dependency, so the visual language stays consistent with the design
   system. Purely a rendering of point weights; it is NOT a flood model output. */

import L from 'leaflet'

export interface DensityPoint {
  lat: number
  lng: number
  weight: number // 0..1
  color: string // rgb triplet e.g. "56,188,242"
}

export interface DensityHandle {
  destroy: () => void
  refresh: (points: DensityPoint[]) => void
  fade: (visible: boolean) => void
}

export function createDensityLayer(map: L.Map, initial: DensityPoint[]): DensityHandle {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.pointerEvents = 'none'
  canvas.style.transition = 'opacity 220ms ease'
  const container = map.getContainer()
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  let points = initial
  let raf = 0

  const draw = () => {
    if (!ctx) return
    const size = map.getSize()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== Math.round(size.x * dpr) || canvas.height !== Math.round(size.y * dpr)) {
      canvas.width = Math.round(size.x * dpr)
      canvas.height = Math.round(size.y * dpr)
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.x, size.y)
    ctx.globalCompositeOperation = 'lighter'

    const zoom = map.getZoom()
    const radius = Math.max(20, Math.min(58, 16 + (zoom - 9) * 7))
    const dim = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1

    for (const p of points) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng])
      if (pt.x < -radius * 2 || pt.y < -radius * 2 || pt.x > size.x + radius * 2 || pt.y > size.y + radius * 2) continue
      const r = radius * (0.65 + p.weight * 0.6)
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r)
      const a = (0.16 + p.weight * 0.3) * (dim || 1)
      g.addColorStop(0, `rgba(${p.color}, ${a})`)
      g.addColorStop(0.55, `rgba(${p.color}, ${a * 0.45})`)
      g.addColorStop(1, `rgba(${p.color}, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  const schedule = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      draw()
    })
  }

  const onZoomStart = () => {
    canvas.style.opacity = '0'
  }
  const onZoomEnd = () => {
    schedule()
    canvas.style.opacity = '1'
  }

  map.on('move zoom resize viewreset', schedule)
  map.on('zoomstart', onZoomStart)
  map.on('zoomend', onZoomEnd)
  schedule()

  return {
    refresh(next) {
      points = next
      schedule()
    },
    fade(visible) {
      canvas.style.opacity = visible ? '1' : '0'
    },
    destroy() {
      map.off('move zoom resize viewreset', schedule)
      map.off('zoomstart', onZoomStart)
      map.off('zoomend', onZoomEnd)
      if (raf) cancelAnimationFrame(raf)
      canvas.remove()
    },
  }
}
