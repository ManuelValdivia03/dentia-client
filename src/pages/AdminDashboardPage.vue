<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  exportAppointmentsByStatus,
  getAppointmentsByStatus,
  getDashboardSummary,
} from '../modules/reports/reports.api'

const summaryQuery = useQuery({
  queryKey: ['reports', 'dashboard-summary'],
  queryFn: () => getDashboardSummary(),
})

const statusQuery = useQuery({
  queryKey: ['reports', 'appointments-by-status'],
  queryFn: () => getAppointmentsByStatus(),
})

const summaryCards = computed(() => {
  const summary = summaryQuery.data.value

  return [
    ['Citas totales', summary?.total_appointments ?? 0],
    ['Programadas', summary?.scheduled ?? 0],
    ['Confirmadas', summary?.confirmed ?? 0],
    ['Completadas', summary?.completed ?? 0],
    ['Canceladas', summary?.cancelled ?? 0],
    ['Efectividad', `${summary?.completion_rate ?? 0}%`],
  ]
})

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: 'Programadas',
    confirmed: 'Confirmadas',
    completed: 'Completadas',
    cancelled: 'Canceladas',
    no_show: 'No asistieron',
  }

  return labels[status] ?? status
}

async function downloadCsv() {
  const blob = await exportAppointmentsByStatus()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'appointments-by-status.csv'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Administrador</p>
        <h2>Panel administrativo</h2>
      </div>

      <button class="secondary-button inline-button" type="button" @click="downloadCsv">
        Exportar CSV
      </button>
    </div>

    <p v-if="summaryQuery.isLoading.value">Cargando reportes...</p>

    <p v-else-if="summaryQuery.isError.value" class="error-message">
      No se pudieron cargar los reportes.
    </p>

    <div v-else class="cards-grid">
      <article v-for="[label, value] in summaryCards" :key="label" class="card metric-card">
        <p>{{ label }}</p>
        <h3>{{ value }}</h3>
      </article>
    </div>

    <div class="section-block">
      <h3>Citas por estado</h3>

      <div v-if="statusQuery.data.value?.data.length" class="list">
        <div
          v-for="item in statusQuery.data.value.data"
          :key="item.status"
          class="list-item"
        >
          <span>{{ statusLabel(item.status) }}</span>
          <strong>{{ item.total }}</strong>
        </div>
      </div>

      <div v-else class="empty-state">
        Todavía no hay datos de citas para reportar.
      </div>
    </div>
  </AppLayout>
</template>
