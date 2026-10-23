/* Data loading: fetches prepared public datasets and parses them defensively.
   Every file is loaded independently so a missing dataset degrades into an
   honest empty/disconnected state instead of a blank screen. */

import type {
  DailyRain,
  DataReport,
  Dataset,
  Hotspot,
  ImdMonthRow,
  StationSummary,
  WardFeature,
} from './types'

const BASE = `${import.meta.env.BASE_URL}data/`

async function fetchText(path: string): Promise<string> {
  const res = await fetch(BASE + path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.text()
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Minimal tolerant CSV parser (handles quotes, CRLF, ragged rows). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '')
}

const numOrNull = (v: string | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseHotspots(text: string): Hotspot[] {
  const gj = JSON.parse(text) as {
    features?: { geometry?: { type?: string; coordinates?: number[] }; properties?: Record<string, unknown> }[]
  }
  const out: Hotspot[] = []
  for (const f of gj.features ?? []) {
    const p = f.properties ?? {}
    const coords = f.geometry?.coordinates
    const lon = numOrNull(String(coords?.[0] ?? ''))
    const lat = numOrNull(String(coords?.[1] ?? ''))
    const name = typeof p.name === 'string' ? p.name.trim() : ''
    if (!name || lon == null || lat == null) continue // drop malformed records
    out.push({
      id: typeof p.id === 'string' ? p.id : name.toLowerCase().replace(/\W+/g, '-'),
      name,
      area: typeof p.area === 'string' ? p.area : null,
      ward: typeof p.ward === 'string' ? p.ward : null,
      inGmc: p.inGmc === true,
      lon,
      lat,
      severity: numOrNull(p.severity == null ? undefined : String(p.severity)),
      depthCm: numOrNull(p.depthCm == null ? undefined : String(p.depthCm)),
      sourceNote: typeof p.sourceNote === 'string' ? p.sourceNote : null,
      description: typeof p.description === 'string' ? p.description : null,
      routeTags: Array.isArray(p.routeTags) ? (p.routeTags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
    })
  }
  return out
}

function parseWards(text: string): WardFeature[] {
  const gj = JSON.parse(text) as {
    features?: { properties?: { name?: string }; geometry?: { type?: string; coordinates?: unknown } }[]
  }
  const out: WardFeature[] = []
  for (const f of gj.features ?? []) {
    const name = f.properties?.name
    const g = f.geometry
    if (!name || !g) continue
    const polys = g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]]
    const rings: [number, number][][] = []
    for (const poly of polys) {
      const outer = poly?.[0]
      if (Array.isArray(outer) && outer.length >= 3) {
        rings.push(outer.map((pt) => [pt[0], pt[1]] as [number, number]))
      }
    }
    if (rings.length) out.push({ name, polygon: rings })
  }
  return out
}

function parseDaily(text: string): DailyRain[] {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const iDate = head.indexOf('date')
  const iCity = head.indexOf('city_mm')
  const iUsed = head.indexOf('stations_used')
  const iRep = head.indexOf('stations_reporting')
  return rows.slice(1).map((r) => ({
    date: (r[iDate] ?? '').trim(),
    cityMm: iCity >= 0 ? numOrNull(r[iCity]) : null,
    stationsUsed: numOrNull(r[iUsed]) ?? 0,
    stationsReporting: numOrNull(r[iRep]) ?? 0,
  })).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
}

function parseImd(text: string): ImdMonthRow[] {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim())
  const iYear = head.findIndex((h) => h.toLowerCase() === 'year')
  const iTotal = head.findIndex((h) => h.toLowerCase() === 'total')
  const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return rows.slice(1).map((r) => {
    const year = numOrNull(r[iYear])
    const months = order.map((m) => {
      const variants = [m, m === 'Jun' ? 'June' : m === 'Jul' ? 'July' : m === 'Sep' ? 'Sept' : m]
      for (const v of variants) {
        const i = head.indexOf(v)
        if (i >= 0) return numOrNull(r[i]) ?? 0
      }
      return 0
    })
    return {
      year: year ?? 0,
      months,
      total: (iTotal >= 0 ? numOrNull(r[iTotal]) : null) ?? months.reduce((a, b) => a + b, 0),
    }
  }).filter((r) => r.year > 1800)
}

function parseStations(text: string): StationSummary[] {
  const arr = JSON.parse(text) as StationSummary[]
  return Array.isArray(arr) ? arr.filter((s) => s && typeof s.station === 'string') : []
}

export async function loadDataset(): Promise<Dataset> {
  const failures: string[] = []
  const safe = async <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn()
    } catch {
      failures.push(name)
      return fallback
    }
  }

  const [hotspots, wards, daily, imd, stations, report] = await Promise.all([
    safe('hotspots.json', async () => parseHotspots(await fetchText('hotspots.json')), [] as Hotspot[]),
    safe('bmc_wards.geojson', async () => parseWards(await fetchText('bmc_wards.geojson')), [] as WardFeature[]),
    safe('rainfall_daily.csv', async () => parseDaily(await fetchText('rainfall_daily.csv')), [] as DailyRain[]),
    safe('mumbai_rainfall_imd_monthly.csv', async () => parseImd(await fetchText('mumbai_rainfall_imd_monthly.csv')), [] as ImdMonthRow[]),
    safe('station_summary.json', async () => parseStations(await fetchText('station_summary.json')), [] as StationSummary[]),
    safe('data_report.json', async () => fetchJson<DataReport>('data_report.json'), null as DataReport | null),
  ])

  return { hotspots, wards, daily, imd, stations, report, failures }
}
