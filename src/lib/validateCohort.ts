import { SCHEMA_VERSION, type CohortData } from '../types/cohort'

// Lightweight structural check for an uploaded cohort file.
// Returns the parsed data, or throws an Error with a readable message.
export function validateCohort(raw: unknown): CohortData {
  if (typeof raw !== 'object' || raw === null) throw new Error('File is not a JSON object.')
  const data = raw as Partial<CohortData>

  if (data.schema_version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema_version "${String(data.schema_version)}" (expected "${SCHEMA_VERSION}").`)
  }
  if (!data.meta || typeof data.meta.generated_at !== 'string' || Number.isNaN(Date.parse(data.meta.generated_at))) {
    throw new Error('meta.generated_at must be a valid ISO 8601 timestamp.')
  }
  if (!Array.isArray(data.subcohorts) || data.subcohorts.length === 0) {
    throw new Error('subcohorts must be a non-empty array.')
  }
  for (const sub of data.subcohorts) {
    if (!sub.id || !sub.name) throw new Error('Every sub-cohort needs an id and a name.')
    if (!Array.isArray(sub.charts)) throw new Error(`Sub-cohort "${sub.name}" needs a charts array.`)
    for (const chart of sub.charts) {
      if (!chart.id || !chart.title || !chart.type) {
        throw new Error(`A chart in "${sub.name}" needs id, title and type.`)
      }
      if (!Array.isArray(chart.datasets) || chart.datasets.length === 0) {
        throw new Error(`Chart "${chart.title}" has no datasets.`)
      }
    }
  }
  return data as CohortData
}
