/* Shared types for CityPulse RainGuard's data layer. */

export interface Hotspot {
  id: string
  name: string
  area: string | null
  ward: string | null
  /** True when the point falls inside a Greater Mumbai (BMC) ward polygon. */
  inGmc: boolean
  lon: number
  lat: number
  /** Severity rating (1-5) as reported by the source inventory. */
  severity: number | null
  /** Reported maximum ponding depth in cm, as stated by the source inventory. */
  depthCm: number | null
  sourceNote: string | null
  description: string | null
  routeTags: string[]
}

export interface WardFeature {
  name: string
  polygon: [number, number][][]
}

export interface DailyRain {
  date: string
  /** City-scale daily rainfall (mm) or null when too few gauges reported. */
  cityMm: number | null
  stationsUsed: number
  stationsReporting: number
}

export interface ImdMonthRow {
  year: number
  months: number[] // Jan..Dec, mm
  total: number
}

export interface StationSummary {
  station: string
  periodStart: string | null
  periodEnd: string | null
  days: number
  totalMm: number
}

export interface DataReport {
  generatedAt: string
  sources: Record<string, string>
  wards: number
  hotspots: {
    total: number
    insideGreaterMumbai: number
    outsideGreaterMumbai: number
    wardCoverage: number
    severityHistogram: Record<string, number>
    firstObsNote: string
  }
  rainfall: {
    stations: string[]
    firstReading: string | null
    lastReading: string | null
    /** Timestamp rows parsed from the workbook. */
    readingRows: number
    timestampRows?: number
    /** Non-null 15-minute gauge values across all stations and days. */
    gaugeObservations?: number
    dailyMeanMm?: number | null
    dailyMaxMm?: number | null
    malformedRows: number
    dailyStart: string | null
    dailyEnd: string | null
    dailyRows: number
    dailyComplete: number
    seasons: string[]
    expectedDays: number
    missingDays: number
    missingDates: string[]
    window: string
    minStationsPerDay: number
    medianStationsPerDay: number
  }
  imdMonthly: {
    rows: number
    startYear: number
    endYear: number
    meanAnnualMm: number
    medianAnnualMm: number
    meanMonsoonMm: number
    maxYear: string
    maxYearMm: number
    minYear: string
    minYearMm: number
  }
}

export interface Dataset {
  hotspots: Hotspot[]
  wards: WardFeature[]
  daily: DailyRain[]
  imd: ImdMonthRow[]
  stations: StationSummary[]
  report: DataReport | null
  /** Names of files that failed to load — drives the disconnected-data states. */
  failures: string[]
}
