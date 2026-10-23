<script setup lang="ts">
import type { SubCohort } from '../types/cohort'
import ChartCard from './ChartCard.vue'

defineProps<{ subcohort: SubCohort }>()
</script>

<template>
  <section v-if="subcohort.status === 'placeholder'" class="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
    <h2 class="text-lg font-semibold text-slate-700">{{ subcohort.name }}</h2>
    <p class="mx-auto mt-2 max-w-md text-sm text-slate-500">{{ subcohort.description }}</p>
    <span class="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Placeholder
    </span>
  </section>

  <section v-else class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold text-slate-800">{{ subcohort.name }}</h2>
      <p class="text-sm text-slate-500">{{ subcohort.description }}</p>
    </div>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
      <div v-for="kpi in subcohort.kpis" :key="kpi.label" class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ kpi.label }}</p>
        <p class="mt-1 text-xl font-bold text-slate-900">{{ kpi.value }}</p>
        <p v-if="kpi.hint" class="mt-1 text-xs text-slate-400">{{ kpi.hint }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard v-for="chart in subcohort.charts" :key="chart.id" :spec="chart" />
    </div>
  </section>
</template>
