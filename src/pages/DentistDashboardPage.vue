<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'
import {
  exportAppointmentsByStatus,
  getAppointmentsByStatus,
  getDashboardSummary,
} from '../modules/reports/reports.api'

const authStore = useAuthStore()
const doctorId = computed(() => authStore.user?.domainId)

const summaryQuery = useQuery({
  queryKey: ['reports', 'dashboard-summary', doctorId],
  queryFn: () => getDashboardSummary(doctorId.value),
})

const statusQuery = useQuery({
  queryKey: ['reports', 'appointments-by-status', doctorId],
  queryFn: () => getAppointmentsByStatus(doctorId.value),
})

async function downloadCsv() {
  const blob = await exportAppointmentsByStatus(doctorId.value)
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
        <p class="eyebrow">Odontólogo</p>
        <h2>Dashboard clínico</h2>
      </div>

      <button class="secondary-button inline-button" type="button" @click="downloadCsv">
        Exportar CSV
      </button>
    </div>

    <p v-if="summaryQuery.isLoading.value">Cargando indicadores...</p>

    <p v-else-if="summaryQuery.isError.value" class="error-message">
      No se pudieron cargar tus indicadores.
    </p>

    <div v-else class="cards-grid">
      <article class="card metric-card">
        <p>Citas totales</p>
        <h3>{{ summaryQuery.data.value?.total_appointments ?? 0 }}</h3>
      </article>
      <article class="card metric-card">
        <p>Confirmadas</p>
        <h3>{{ summaryQuery.data.value?.confirmed ?? 0 }}</h3>
      </article>
      <article class="card metric-card">
        <p>Completadas</p>
        <h3>{{ summaryQuery.data.value?.completed ?? 0 }}</h3>
      </article>
      <article class="card metric-card">
        <p>Efectividad</p>
        <h3>{{ summaryQuery.data.value?.completion_rate ?? 0 }}%</h3>
      </article>
    </div>

    <div class="section-block">
      <h3>Distribución de citas</h3>

      <div v-if="statusQuery.data.value?.data.length" class="list">
        <div
          v-for="item in statusQuery.data.value.data"
          :key="item.status"
          class="list-item"
        >
          <span>{{ item.status }}</span>
          <strong>{{ item.total }}</strong>
        </div>
      </div>

      <div v-else class="empty-state">
        Todavía no hay datos para mostrar.
      </div>
    </div>
  </AppLayout>
</template>
