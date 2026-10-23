<script setup lang="ts">
import { Chart, registerables, type ChartConfiguration, type ChartData, type ChartOptions } from 'chart.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChartSpec } from '../types/cohort'

Chart.register(...registerables)

const props = defineProps<{ spec: ChartSpec }>()

// Used when a dataset has no explicit colour (pie, doughnut and multi-series defaults).
const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function buildConfig(spec: ChartSpec): ChartConfiguration {
  const isPie = spec.type === 'pie' || spec.type === 'doughnut'
  const isScatter = spec.type === 'scatter'
  const isHorizontal = spec.type === 'horizontalBar'
  const isStacked = spec.type === 'stackedBar'
  const isRadar = spec.type === 'radar'

  // Chart.js has no separate horizontal/stacked types, so map them onto bar.
  const type = (isHorizontal || isStacked ? 'bar' : spec.type) as ChartConfiguration['type']

  const datasets = spec.datasets.map((ds, i) => {
    const color = ds.color ?? PALETTE[i % PALETTE.length]
    if (isPie) {
      return {
        label: ds.label,
        data: ds.data as number[],
        backgroundColor: PALETTE.slice(0, (ds.data as number[]).length),
        borderWidth: 1,
      }
    }
    if (isScatter) {
      return { label: ds.label, data: ds.data as { x: number; y: number }[], backgroundColor: color, pointRadius: 3 }
    }
    if (spec.type === 'line') {
      return { label: ds.label, data: ds.data as number[], borderColor: color, backgroundColor: color, tension: 0.25, pointRadius: 2 }
    }
    if (isRadar) {
      return { label: ds.label, data: ds.data as number[], borderColor: color, backgroundColor: `${color}33`, pointRadius: 2 }
    }
    return { label: ds.label, data: ds.data as number[], backgroundColor: color, borderColor: color, borderWidth: 0 }
  })

  const data = { labels: spec.labels, datasets } as ChartData

  const axisTitle = (text?: string) => (text ? { display: true, text } : undefined)
  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: isHorizontal ? 'y' : 'x',
    plugins: {
      legend: { display: isPie || spec.datasets.length > 1, position: 'bottom' },
    },
  }

  if (!isPie && !isRadar) {
    options.scales = {
      x: { stacked: isStacked, title: axisTitle(spec.xLabel) },
      y: { stacked: isStacked, title: axisTitle(spec.yLabel), beginAtZero: !isScatter },
    }
  }
  if (isRadar) {
    options.scales = { r: { beginAtZero: true, max: 100 } }
  }

  return { type, data, options }
}

function render() {
  if (!canvas.value) return
  chart?.destroy()
  chart = new Chart(canvas.value, buildConfig(props.spec))
}

onMounted(render)
watch(() => props.spec, render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="mb-3">
      <h3 class="text-sm font-semibold text-slate-800">{{ spec.title }}</h3>
      <p v-if="spec.subtitle" class="text-xs text-slate-500">{{ spec.subtitle }}</p>
    </div>
    <div class="relative h-72">
      <canvas ref="canvas" role="img" :aria-label="spec.title"></canvas>
    </div>
  </div>
</template>
