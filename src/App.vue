<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DataSourceBar from './components/DataSourceBar.vue'
import SubCohortPanel from './components/SubCohortPanel.vue'
import { validateCohort } from './lib/validateCohort'
import type { CohortData } from './types/cohort'

const DATA_URL = `${import.meta.env.BASE_URL}data/cohort.json`
const buildTime = __BUILD_TIME__

const data = ref<CohortData | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)
const source = ref<'bundled' | 'uploaded'>('bundled')
const fileName = ref<string | undefined>()
const activeId = ref<string>('')

const active = computed(() => data.value?.subcohorts.find((s) => s.id === activeId.value))

function setData(next: CohortData) {
  data.value = next
  // Keep the current tab if it still exists in the new file, otherwise go to the first one.
  if (!next.subcohorts.some((s) => s.id === activeId.value)) activeId.value = next.subcohorts[0].id
}

async function loadBundled() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${res.status}).`)
    setData(validateCohort(await res.json()))
    source.value = 'bundled'
    fileName.value = undefined
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// Preview a local JSON file in the browser. Nothing is uploaded or stored.
async function onUpload(file: File) {
  error.value = null
  try {
    setData(validateCohort(JSON.parse(await file.text())))
    source.value = 'uploaded'
    fileName.value = file.name
  } catch (e) {
    error.value = `"${file.name}" could not be loaded: ${e instanceof Error ? e.message : String(e)}`
  }
}

onMounted(loadBundled)
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header>
      <h1 class="text-2xl font-bold text-slate-900 md:text-3xl">{{ data?.meta.title ?? 'Cohort Dashboard' }}</h1>
      <p v-if="data" class="text-sm text-slate-500">{{ data.meta.cohort }}</p>
    </header>

    <p v-if="data" class="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
      {{ data.meta.data_source }}
    </p>

    <DataSourceBar
      v-if="data"
      :generated-at="data.meta.generated_at"
      :source="source"
      :file-name="fileName"
      :build-time="buildTime"
      @upload="onUpload"
    />

    <p v-if="error" class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{{ error }}</p>

    <p v-if="loading" class="text-sm text-slate-500">Loading data…</p>

    <template v-if="data">
      <nav class="flex flex-wrap gap-2 border-b border-slate-300" role="tablist" aria-label="Sub-cohorts">
        <button
          v-for="sub in data.subcohorts"
          :key="sub.id"
          type="button"
          role="tab"
          :aria-selected="sub.id === activeId"
          class="-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition"
          :class="
            sub.id === activeId
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          "
          @click="activeId = sub.id"
        >
          {{ sub.name }}
          <span v-if="sub.status === 'placeholder'" class="ml-1 text-xs text-slate-400">(placeholder)</span>
        </button>
      </nav>

      <SubCohortPanel v-if="active" :subcohort="active" />
    </template>
  </div>
</template>
