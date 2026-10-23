// Generates the synthetic demo cohort that the dashboard reads.
//
// Usage: bun run scripts/generate-sample-data.ts [output-path]
//
// No real patient data is used. Every value is a random draw from assumed
// distributions with a fixed seed, so the output is reproducible.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChartSpec, CohortData, Kpi, Point, SubCohort } from '../src/types/cohort'
import { SCHEMA_VERSION } from '../src/types/cohort'

const SEED = 20261023
const N_PATIENTS = 300
// Data cut-off: 2026-10-01. Diagnoses span 2022-01 to 2026-09 (19 quarters).
const CUTOFF_MONTH_INDEX = 57
const N_QUARTERS = 19

// ---------- seeded random helpers ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)

function normal(mean: number, sd: number): number {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function weighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [item, w] of items) {
    r -= w
    if (r <= 0) return item
  }
  return items[items.length - 1][0]
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// ---------- synthetic cohort definition ----------

type Risk = 'Low' | 'Intermediate' | 'High'
type Treatment = 'Active surveillance' | 'Radical prostatectomy' | 'Brachytherapy' | 'EBRT' | 'EBRT + ADT'

const RISKS: Risk[] = ['Low', 'Intermediate', 'High']
const RISK_COLORS: Record<Risk, string> = { Low: '#10b981', Intermediate: '#f59e0b', High: '#ef4444' }

const RACES: [string, number][] = [
  ['White', 62],
  ['Black', 21],
  ['Hispanic', 8],
  ['Asian', 6],
  ['Other / unknown', 3],
]

const STAGES: [string, number][] = [
  ['cT1c', 45],
  ['cT2a', 25],
  ['cT2b', 18],
  ['cT2c', 12],
]

const AGE_GROUPS = ['<60', '60-64', '65-69', '70-74', '75+']

const TREATMENT_WEIGHTS: Record<Risk, [Treatment, number][]> = {
  Low: [
    ['Active surveillance', 55],
    ['Radical prostatectomy', 25],
    ['Brachytherapy', 20],
  ],
  Intermediate: [
    ['Radical prostatectomy', 40],
    ['EBRT', 30],
    ['Brachytherapy', 20],
    ['Active surveillance', 10],
  ],
  High: [
    ['EBRT + ADT', 60],
    ['Radical prostatectomy', 30],
    ['EBRT', 10],
  ],
}

// Mean time to biochemical recurrence (months), used only to simulate survival.
const BCR_MEAN_MONTHS: Record<Risk, number> = { Low: 200, Intermediate: 90, High: 40 }

const QOL_DOMAINS = ['Urinary', 'Bowel', 'Sexual', 'Hormonal', 'Emotional']
const QOL_ARMS: { name: string; color: string; means: number[] }[] = [
  { name: 'Radical prostatectomy', color: '#3b82f6', means: [58, 90, 30, 88, 78] },
  { name: 'Radiotherapy (EBRT +/- ADT)', color: '#f59e0b', means: [72, 75, 45, 70, 80] },
  { name: 'Active surveillance', color: '#10b981', means: [85, 95, 65, 95, 85] },
]

function qolArm(t: Treatment): string | null {
  if (t === 'Radical prostatectomy') return 'Radical prostatectomy'
  if (t === 'EBRT' || t === 'EBRT + ADT') return 'Radiotherapy (EBRT +/- ADT)'
  if (t === 'Active surveillance') return 'Active surveillance'
  return null
}

function gradeWeights(psa: number): [number, number][] {
  if (psa < 10) return [[1, 50], [2, 30], [3, 15], [4, 3], [5, 2]]
  if (psa <= 20) return [[1, 20], [2, 35], [3, 25], [4, 12], [5, 8]]
  return [[1, 5], [2, 15], [3, 30], [4, 30], [5, 20]]
}

interface Patient {
  age: number
  race: string
  stage: string
  gradeGroup: number
  psa: number
  risk: Risk
  treatment: Treatment
  dxQuarter: number
  followUpMonths: number
  bcrMonths: number
  bcrEvent: boolean
  qol: number[] | null
}

function generatePatient(): Patient {
  const age = clamp(Math.round(normal(67, 7)), 42, 90)
  const race = weighted(RACES)
  const stage = weighted(STAGES)
  const psa = clamp(Math.exp(normal(Math.log(7), 0.6)), 1.5, 80)
  const gradeGroup = weighted(gradeWeights(psa))

  const risk: Risk =
    gradeGroup >= 4 || psa > 20 || stage === 'cT2c'
      ? 'High'
      : gradeGroup === 1 && psa < 10 && (stage === 'cT1c' || stage === 'cT2a')
        ? 'Low'
        : 'Intermediate'

  const treatment = weighted(TREATMENT_WEIGHTS[risk])

  // Skew diagnoses toward recent quarters so the trend chart rises over time.
  const dxQuarter = Math.min(N_QUARTERS - 1, Math.floor(N_QUARTERS * Math.sqrt(rand())))
  const offset = dxQuarter * 3 + rand() * 3
  const followUpMonths = Math.max(1, CUTOFF_MONTH_INDEX - offset)

  const bcrTime = -BCR_MEAN_MONTHS[risk] * Math.log(Math.max(rand(), 1e-12))
  const bcrEvent = bcrTime < followUpMonths
  const bcrMonths = bcrEvent ? bcrTime : followUpMonths

  const arm = qolArm(treatment)
  const qol = arm
    ? QOL_ARMS.find((a) => a.name === arm)!.means.map((m) => clamp(normal(m, 10), 0, 100))
    : null

  return {
    age,
    race,
    stage,
    gradeGroup,
    psa: Math.round(psa * 10) / 10,
    risk,
    treatment,
    dxQuarter,
    followUpMonths: Math.round(followUpMonths * 10) / 10,
    bcrMonths: Math.round(bcrMonths * 10) / 10,
    bcrEvent,
    qol,
  }
}

// ---------- statistics ----------

// Kaplan-Meier survival (0-1) evaluated at each requested time.
function kaplanMeier(items: { time: number; event: boolean }[], times: number[]): number[] {
  const eventTimes = [...new Set(items.filter((i) => i.event).map((i) => i.time))].sort((a, b) => a - b)
  const steps: Point[] = []
  let surv = 1
  for (const t of eventTimes) {
    const atRisk = items.filter((i) => i.time >= t).length
    const deaths = items.filter((i) => i.event && i.time === t).length
    surv *= 1 - deaths / atRisk
    steps.push({ x: t, y: surv })
  }
  return times.map((t) => {
    let s = 1
    for (const step of steps) {
      if (step.x <= t) s = step.y
      else break
    }
    return s
  })
}

function countBy<T>(items: T[], keys: readonly T[]): number[] {
  return keys.map((k) => items.filter((i) => i === k).length)
}

// ---------- build the first sub-cohort ----------

function buildNewlyDiagnosedCohort(patients: Patient[]): SubCohort {
  const n = patients.length
  const pct = (count: number) => Math.round((count / n) * 1000) / 10
  const ageGroupOf = (age: number) =>
    age < 60 ? '<60' : age < 65 ? '60-64' : age < 70 ? '65-69' : age < 75 ? '70-74' : '75+'

  // KPIs
  const overallSurv36 = kaplanMeier(
    patients.map((p) => ({ time: p.bcrMonths, event: p.bcrEvent })),
    [36],
  )[0]
  const kpis: Kpi[] = [
    { label: 'Patients', value: String(n), hint: 'Synthetic records' },
    { label: 'Median age', value: `${median(patients.map((p) => p.age))} years` },
    { label: 'Median PSA at diagnosis', value: `${median(patients.map((p) => p.psa)).toFixed(1)} ng/mL` },
    {
      label: 'High-risk share',
      value: `${pct(patients.filter((p) => p.risk === 'High').length)}%`,
      hint: 'NCCN-style grouping',
    },
    {
      label: '3-year BCR-free',
      value: `${(overallSurv36 * 100).toFixed(1)}%`,
      hint: 'Kaplan-Meier, all patients',
    },
  ]

  // Demographics
  const raceLabels = RACES.map(([r]) => r)
  const raceChart: ChartSpec = {
    id: 'race-distribution',
    title: 'Race and ethnicity',
    subtitle: `n = ${n}`,
    type: 'doughnut',
    labels: raceLabels,
    datasets: [{ label: 'Patients', data: countBy(patients.map((p) => p.race), raceLabels) }],
  }

  const ageChart: ChartSpec = {
    id: 'age-distribution',
    title: 'Age at diagnosis',
    subtitle: `Median ${median(patients.map((p) => p.age))} years`,
    type: 'bar',
    labels: AGE_GROUPS,
    xLabel: 'Age group (years)',
    yLabel: 'Patients',
    datasets: [{ label: 'Patients', data: countBy(patients.map((p) => ageGroupOf(p.age)), AGE_GROUPS) }],
  }

  const stageLabels = STAGES.map(([s]) => s)
  const stageChart: ChartSpec = {
    id: 'stage-distribution',
    title: 'Clinical T stage',
    subtitle: 'Localized disease only',
    type: 'pie',
    labels: stageLabels,
    datasets: [{ label: 'Patients', data: countBy(patients.map((p) => p.stage), stageLabels) }],
  }

  // Clinical
  const riskByAge: ChartSpec = {
    id: 'risk-by-age',
    title: 'Risk group by age',
    subtitle: 'Stacked counts',
    type: 'stackedBar',
    labels: AGE_GROUPS,
    xLabel: 'Age group (years)',
    yLabel: 'Patients',
    datasets: RISKS.map((risk) => ({
      label: risk,
      color: RISK_COLORS[risk],
      data: countBy(
        patients.filter((p) => p.risk === risk).map((p) => ageGroupOf(p.age)),
        AGE_GROUPS,
      ),
    })),
  }

  const treatmentOrder = [...new Set(Object.values(TREATMENT_WEIGHTS).flat().map(([t]) => t))]
  const treatmentCounts = treatmentOrder
    .map((t) => ({ t, count: patients.filter((p) => p.treatment === t).length }))
    .sort((a, b) => b.count - a.count)
  const treatmentChart: ChartSpec = {
    id: 'treatment-modality',
    title: 'Initial treatment modality',
    subtitle: 'Sorted by volume',
    type: 'horizontalBar',
    labels: treatmentCounts.map((x) => x.t),
    datasets: [{ label: 'Patients', data: treatmentCounts.map((x) => x.count) }],
  }

  const psaScatter: ChartSpec = {
    id: 'psa-vs-age',
    title: 'PSA at diagnosis vs age',
    subtitle: 'Each point is one patient; PSA capped at 50 ng/mL for display',
    type: 'scatter',
    xLabel: 'Age (years)',
    yLabel: 'PSA (ng/mL)',
    datasets: RISKS.map((risk) => ({
      label: risk,
      color: RISK_COLORS[risk],
      data: patients
        .filter((p) => p.risk === risk)
        .map((p) => ({ x: p.age, y: Math.min(p.psa, 50) })),
    })),
  }

  // Trend
  const quarterLabels = Array.from({ length: N_QUARTERS }, (_, q) => `Q${(q % 4) + 1} ${2022 + Math.floor(q / 4)}`)
  const trendChart: ChartSpec = {
    id: 'diagnoses-trend',
    title: 'New diagnoses per quarter',
    subtitle: 'Total and high-risk',
    type: 'line',
    labels: quarterLabels,
    xLabel: 'Quarter of diagnosis',
    yLabel: 'Patients',
    datasets: [
      {
        label: 'All risk groups',
        color: '#3b82f6',
        data: countBy(patients.map((p) => p.dxQuarter), Array.from({ length: N_QUARTERS }, (_, q) => q)),
      },
      {
        label: 'High risk',
        color: RISK_COLORS.High,
        data: countBy(
          patients.filter((p) => p.risk === 'High').map((p) => p.dxQuarter),
          Array.from({ length: N_QUARTERS }, (_, q) => q),
        ),
      },
    ],
  }

  // Survival (Kaplan-Meier on simulated BCR-free time)
  const survivalMonths = Array.from({ length: 17 }, (_, i) => i * 3)
  const survivalChart: ChartSpec = {
    id: 'bcr-free-survival',
    title: 'Biochemical recurrence-free survival',
    subtitle: 'Kaplan-Meier by risk group, 0-48 months',
    type: 'line',
    labels: survivalMonths.map(String),
    xLabel: 'Months since diagnosis',
    yLabel: 'BCR-free (%)',
    datasets: RISKS.map((risk) => {
      const group = patients.filter((p) => p.risk === risk)
      const surv = kaplanMeier(
        group.map((p) => ({ time: p.bcrMonths, event: p.bcrEvent })),
        survivalMonths,
      )
      return {
        label: `${risk} (n=${group.length})`,
        color: RISK_COLORS[risk],
        data: surv.map((s) => Math.round(s * 1000) / 10),
      }
    }),
  }

  // Patient-reported QoL radar
  const qolChart: ChartSpec = {
    id: 'qol-by-treatment',
    title: 'Patient-reported domain scores by treatment',
    subtitle: 'Mean score, 0-100 (higher is better), synthetic',
    type: 'radar',
    labels: QOL_DOMAINS,
    datasets: QOL_ARMS.map((arm) => {
      const rows = patients.filter((p) => p.qol && qolArm(p.treatment) === arm.name).map((p) => p.qol!)
      const means = QOL_DOMAINS.map((_, d) => Math.round(rows.reduce((s, r) => s + r[d], 0) / rows.length))
      return { label: `${arm.name} (n=${rows.length})`, color: arm.color, data: means }
    }),
  }

  return {
    id: 'newly-diagnosed',
    name: 'Newly diagnosed (localized)',
    status: 'ready',
    description:
      'Men newly diagnosed with localized prostate cancer (cT1c to cT2c). Synthetic demonstration data, not patient records.',
    kpis,
    charts: [
      raceChart,
      ageChart,
      stageChart,
      riskByAge,
      treatmentChart,
      psaScatter,
      trendChart,
      survivalChart,
      qolChart,
    ],
  }
}

// ---------- placeholders for the other four sub-cohorts ----------

const PLACEHOLDERS: { id: string; name: string }[] = [
  { id: 'mcrpc', name: 'Metastatic castration-resistant (mCRPC)' },
  { id: 'active-surveillance', name: 'Active surveillance' },
  { id: 'post-prostatectomy', name: 'Post-prostatectomy' },
  { id: 'radiotherapy', name: 'Radiotherapy' },
]

function placeholder(id: string, name: string): SubCohort {
  return {
    id,
    name,
    status: 'placeholder',
    description: 'Data for this sub-cohort is not yet available. This tab is a placeholder.',
    kpis: [],
    charts: [],
  }
}

// ---------- main ----------

const patients = Array.from({ length: N_PATIENTS }, generatePatient)
const newlyDiagnosed = buildNewlyDiagnosedCohort(patients)

const data: CohortData = {
  schema_version: SCHEMA_VERSION,
  meta: {
    title: 'Prostate Cancer Cohort Dashboard',
    cohort: 'Prostate cancer (synthetic demo cohort)',
    data_source: 'Synthetic data generated for demonstration. Not patient data.',
    generated_at: new Date().toISOString(),
  },
  subcohorts: [newlyDiagnosed, ...PLACEHOLDERS.map((p) => placeholder(p.id, p.name))],
}

const defaultOutput = fileURLToPath(new URL('../public/data/cohort.json', import.meta.url))
const outPath = resolve(process.argv[2] ?? defaultOutput)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n')

console.log(`Wrote ${outPath}`)
console.log(`Patients: ${N_PATIENTS}, charts in ready sub-cohort: ${newlyDiagnosed.charts.length}`)
