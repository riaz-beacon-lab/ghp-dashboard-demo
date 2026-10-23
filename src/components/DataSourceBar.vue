<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  generatedAt: string
  source: 'bundled' | 'uploaded'
  fileName?: string
  buildTime: string
}>()

const emit = defineEmits<{ upload: [file: File] }>()

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

// "3 hours ago", "yesterday", etc. Falls back to days for anything older than a month.
function timeAgo(iso: string): string {
  const diffSec = Math.round((Date.parse(iso) - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) return relative.format(Math.round(diffSec / secs), unit)
  }
  return relative.format(diffSec, 'second')
}

const updatedLabel = computed(() => dateFormat.format(new Date(props.generatedAt)))
const updatedAgo = computed(() => timeAgo(props.generatedAt))
const deployedLabel = computed(() => dateFormat.format(new Date(props.buildTime)))

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload', file)
  input.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
    <dl class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
      <div>
        <dt class="text-xs uppercase tracking-wide text-slate-500">Data last updated</dt>
        <dd class="font-medium text-slate-900">
          {{ updatedLabel }} <span class="font-normal text-slate-500">({{ updatedAgo }})</span>
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-slate-500">Site deployed</dt>
        <dd class="font-medium text-slate-900">{{ deployedLabel }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-slate-500">Showing</dt>
        <dd class="font-medium text-slate-900">
          <template v-if="source === 'uploaded'">Local file: {{ fileName }}</template>
          <template v-else>Published data file</template>
        </dd>
      </div>
    </dl>

    <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
      Preview a JSON file
      <input type="file" accept="application/json,.json" class="sr-only" @change="onFileChange" />
    </label>
  </div>
</template>
