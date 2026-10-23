// Shape of the cohort JSON file that drives the dashboard.
// Every chart is fully described in the JSON; the front end only renders it.

export const SCHEMA_VERSION = '1.0'

export type ChartType = 'pie' | 'doughnut' | 'bar' | 'horizontalBar' | 'stackedBar' | 'line' | 'scatter' | 'radar'

export interface Point {
  x: number
  y: number
}

export interface ChartDataset {
  label: string
  data: number[] | Point[]
  color?: string
}

export interface ChartSpec {
  id: string
  title: string
  subtitle?: string
  type: ChartType
  labels?: string[]
  datasets: ChartDataset[]
  xLabel?: string
  yLabel?: string
}

export interface Kpi {
  label: string
  value: string
  hint?: string
}

export interface SubCohort {
  id: string
  name: string
  // "ready" = has charts; "placeholder" = data not yet available
  status: 'ready' | 'placeholder'
  description: string
  kpis: Kpi[]
  charts: ChartSpec[]
}

export interface CohortData {
  schema_version: string
  meta: {
    title: string
    cohort: string
    data_source: string
    // When the data file was generated/submitted (ISO 8601, UTC)
    generated_at: string
  }
  subcohorts: SubCohort[]
}
