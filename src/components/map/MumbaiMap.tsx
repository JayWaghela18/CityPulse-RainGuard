/* The signature Mumbai intelligence map — imperative Leaflet wrapper.
   Renders ward boundaries, custom hotspot markers, a custom canvas density
   layer, permanent ward labels, floating controls and tooltips. */

import {
  Crosshair,
  Layers,
  Minus,
  Moon,
  Plus,
  Sun,
} from 'lucide-react'
import L from 'leaflet'
import { useEffect, useRef, type ReactNode } from 'react'
import { severityMeta } from '../../lib/format'
import type { Hotspot, WardFeature } from '../../lib/types'
import { createDensityLayer, type DensityHandle, type DensityPoint } from './density'

export type MapMode = 'points' | 'density'
export type Basemap = 'dark' | 'light'

export interface MumbaiMapProps {
  hotspots: Hotspot[]
  wards: WardFeature[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  mode: MapMode
  basemap: Basemap
  showWards: boolean
  onModeChange?: (m: MapMode) => void
  onBasemapChange?: (b: Basemap) => void
  onWardsChange?: (v: boolean) => void
  /** Change to re-fit the view to the data. */
  fitToken?: string | number
  /** Pan to the selected marker (Explore page). */
  flyToSelected?: boolean
  wheelZoom?: boolean
  /** Floating controls cluster shown top-right. */
  compactControls?: boolean
  overlay?: ReactNode
  className?: string
}

/* Esri's keyless Canvas basemaps: a dark and a light style, each with a
   matching label/reference layer. CARTO's public basemaps now require an API
   key, so they were replaced to keep the product dependency-free. */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/'
const ESRI_ATTR = 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'

const TILES: Record<Basemap, { base: string; labels: string; attribution: string }> = {
  dark: {
    base: `${ESRI}World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
  },
  light: {
    base: `${ESRI}World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
  },
}

const hexToRgb = (hex: string): string => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

const markerColor = (h: Hotspot) => (h.inGmc ? severityMeta(h.severity).color : '#8fa1c4')

const markerHtml = (h: Hotspot, selected: boolean) => {
  const color = markerColor(h)
  return `<div class="cp-marker" data-selected="${selected}" style="--ring:${color};--glow:${color}55">
    <span class="halo"></span><span class="dot" style="background:${color}"></span>
  </div>`
}

export function MumbaiMap({
  hotspots,
  wards,
  selectedId,
  onSelect,
  mode,
  basemap,
  showWards,
  onModeChange,
  onBasemapChange,
  onWardsChange,
  fitToken = 0,
  flyToSelected = false,
  wheelZoom = false,
  compactControls = false,
  overlay,
  className = '',
}: MumbaiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const labelTileRef = useRef<L.TileLayer | null>(null)
  const wardGroupRef = useRef<L.LayerGroup | null>(null)
  const labelGroupRef = useRef<L.LayerGroup | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  const densityRef = useRef<DensityHandle | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  /* ---- create map once ---- */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: wheelZoom,
      zoomSnap: 0.5,
      zoomAnimation: !reduced,
      fadeAnimation: !reduced,
    }).setView([19.0765, 72.8774], 10.5)
    mapRef.current = map

    // Deselect only when the click really landed on the base map — not on a marker.
    const onClickAway = (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent?.target as HTMLElement | null
      if (target?.closest('.leaflet-marker-icon')) return
      onSelectRef.current(null)
    }
    map.on('click', onClickAway)

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      map.off('click', onClickAway)
      densityRef.current?.destroy()
      densityRef.current = null
      map.remove()
      mapRef.current = null
    }
    // wheelZoom is fixed per mount by design
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- basemap ---- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const cfg = TILES[basemap]
    if (tileRef.current) {
      map.removeLayer(tileRef.current)
      tileRef.current = null
    }
    if (labelTileRef.current) {
      map.removeLayer(labelTileRef.current)
      labelTileRef.current = null
    }
    const base = L.tileLayer(cfg.base, {
      attribution: cfg.attribution,
      maxZoom: 19,
      maxNativeZoom: 16,
    })
    base.addTo(map)
    tileRef.current = base
    base.bringToBack()

    const labels = L.tileLayer(cfg.labels, { maxZoom: 19, maxNativeZoom: 16, opacity: 0.9 })
    labels.addTo(map)
    labelTileRef.current = labels
  }, [basemap])

  /* ---- ward boundaries + labels ---- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (wardGroupRef.current) {
      map.removeLayer(wardGroupRef.current)
      wardGroupRef.current = null
    }
    if (labelGroupRef.current) {
      map.removeLayer(labelGroupRef.current)
      labelGroupRef.current = null
    }
    if (!showWards || !wards.length) return

    const group = L.layerGroup().addTo(map)
    wardGroupRef.current = group
    const labels = L.layerGroup().addTo(map)
    labelGroupRef.current = labels

    for (const w of wards) {
      const rings = w.polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number]))
      let centroid: [number, number] | null = null
      for (const ring of rings) {
        const layer = L.polygon(ring, {
          color: '#5aa9e6',
          weight: 1,
          opacity: 0.55,
          fillColor: '#38bcf2',
          fillOpacity: 0.05,
          dashArray: '5 7',
          lineJoin: 'round',
        })
        layer.on('mouseover', () => {
          layer.setStyle({ weight: 1.8, opacity: 0.9, fillOpacity: 0.12, dashArray: '' })
        })
        layer.on('mouseout', () => {
          layer.setStyle({ weight: 1, opacity: 0.55, fillOpacity: 0.05, dashArray: '5 7' })
        })
        layer.addTo(group)
        if (!centroid) {
          const lats = ring.map((p) => p[0])
          const lons = ring.map((p) => p[1])
          centroid = [lats.reduce((a, b) => a + b, 0) / lats.length, lons.reduce((a, b) => a + b, 0) / lons.length]
        }
      }
      if (centroid) {
        const icon = L.divIcon({
          className: 'cp-ward-label',
          html: w.name,
          iconSize: [44, 12],
          iconAnchor: [22, 6],
        })
        L.marker(centroid, { icon, interactive: false, keyboard: false }).addTo(labels)
      }
    }

    const applyLabelVisibility = () => {
      const show = map.getZoom() >= 11
      labels.eachLayer((l) => {
        if (l instanceof L.Marker) l.setOpacity(show ? 1 : 0)
      })
    }
    applyLabelVisibility()
    map.on('zoomend', applyLabelVisibility)
    return () => {
      map.off('zoomend', applyLabelVisibility)
    }
  }, [wards, showWards])

  /* ---- markers / density ---- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerGroupRef.current) {
      map.removeLayer(markerGroupRef.current)
      markerGroupRef.current = null
    }
    if (densityRef.current) {
      densityRef.current.destroy()
      densityRef.current = null
    }
    if (!hotspots.length) return

    const group = L.layerGroup().addTo(map)
    markerGroupRef.current = group

    const addMarker = (h: Hotspot) => {
      const selected = h.id === selectedId
      const icon = L.divIcon({
        className: '',
        html: markerHtml(h, selected),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      const meta = severityMeta(h.severity)
      const marker = L.marker([h.lat, h.lon], {
        icon,
        keyboard: true,
        title: h.name,
        riseOnHover: true,
        zIndexOffset: selected ? 1000 : 0,
      })
      marker.bindTooltip(
        `<strong>${h.name}</strong><br/>${h.ward ? `Ward ${h.ward} · ` : ''}${h.area ?? ''}${
          h.severity != null ? `<br/>Reported severity ${h.severity}/5 · ${meta.label}` : ''
        }`,
        { className: 'hotspot-tip', direction: 'top', offset: [0, -10], opacity: 1 },
      )
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e.originalEvent)
        onSelectRef.current(h.id)
      })
      marker.addTo(group)
    }

    if (mode === 'density') {
      const points: DensityPoint[] = hotspots
        .filter((h) => h.id !== selectedId)
        .map((h) => ({
          lat: h.lat,
          lng: h.lon,
          weight: Math.max(0.25, (h.severity ?? 3) / 5) * (h.inGmc ? 1 : 0.6),
          color: hexToRgb(markerColor(h)),
        }))
      densityRef.current = createDensityLayer(map, points)
      const sel = hotspots.find((h) => h.id === selectedId)
      if (sel) addMarker(sel)
    } else {
      for (const h of hotspots) addMarker(h)
    }
  }, [hotspots, mode, selectedId])

  /* ---- fit to data ---- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pts: [number, number][] = hotspots.length
      ? hotspots.map((h) => [h.lat, h.lon])
      : wards.flatMap((w) => w.polygon[0].map(([lon, lat]): [number, number] => [lat, lon]))
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [46, 46], paddingBottomRight: [46, 46], maxZoom: 12 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken])

  /* ---- fly to selection ---- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToSelected || !selectedId) return
    const h = hotspots.find((x) => x.id === selectedId)
    if (!h) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = L.latLng(h.lat, h.lon)
    if (map.getBounds().contains(target) && map.getZoom() >= 12) return
    map.flyTo(target, Math.max(map.getZoom(), 12.5), { duration: reduced ? 0 : 0.7 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const zoomBy = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    if (delta > 0) map.zoomIn(delta)
    else map.zoomOut(-delta)
  }
  const fit = () => {
    const map = mapRef.current
    if (!map || !hotspots.length) return
    const bounds = L.latLngBounds(hotspots.map((h) => [h.lat, h.lon] as [number, number]))
    map.fitBounds(bounds, { paddingTopLeft: [46, 46], paddingBottomRight: [46, 46], maxZoom: 12 })
  }

  const iconBtn =
    'grid h-8 w-8 place-items-center rounded-[9px] border border-white/10 bg-ink-850/90 text-fog-300 backdrop-blur transition hover:border-rain-400/50 hover:text-rain-200'

  return (
    <div
      className={`${className.includes('absolute') ? '' : 'relative'} overflow-hidden ${className}`}
      data-basemap={basemap}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* mode switch */}
      {onModeChange && (
        <div className="absolute left-3 top-3 z-[500] flex rounded-[10px] border border-white/10 bg-ink-850/90 p-1 backdrop-blur-md">
          {(['points', 'density'] as MapMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              data-active={mode === m}
              aria-pressed={mode === m}
              className="rounded-[7px] px-3 py-1.5 text-[11.5px] font-semibold capitalize transition"
              style={
                mode === m
                  ? { background: 'linear-gradient(180deg,#6fd2f7,#139dd9)', color: '#06101d' }
                  : { color: '#7d8db1' }
              }
            >
              {m === 'points' ? 'Points' : 'Hotspot density'}
            </button>
          ))}
        </div>
      )}

      {/* right cluster */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-1.5">
        <button className={iconBtn} aria-label="Zoom in" onClick={() => zoomBy(1)}>
          <Plus size={15} />
        </button>
        <button className={iconBtn} aria-label="Zoom out" onClick={() => zoomBy(-1)}>
          <Minus size={15} />
        </button>
        <button className={iconBtn} aria-label="Reset view to all hotspots" onClick={fit}>
          <Crosshair size={14.5} />
        </button>
        {!compactControls && onBasemapChange && (
          <button
            className={iconBtn}
            aria-label={basemap === 'dark' ? 'Switch to light basemap' : 'Switch to dark basemap'}
            aria-pressed={basemap === 'light'}
            onClick={() => onBasemapChange(basemap === 'dark' ? 'light' : 'dark')}
          >
            {basemap === 'dark' ? <Sun size={14.5} /> : <Moon size={14.5} />}
          </button>
        )}
        {!compactControls && onWardsChange && (
          <button
            className={iconBtn}
            aria-label="Toggle ward boundaries"
            aria-pressed={showWards}
            style={showWards ? { borderColor: 'rgba(56,188,242,0.55)', color: '#6fd2f7' } : undefined}
            onClick={() => onWardsChange(!showWards)}
          >
            <Layers size={14.5} />
          </button>
        )}
      </div>

      {overlay}
    </div>
  )
}
