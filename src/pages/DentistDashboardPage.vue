<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  getAppointments,
  type Appointment,
} from '../modules/appointments/appointments.api'

const appointmentsQuery = useQuery({
  queryKey: ['appointments', 'dentist-dashboard'],
  queryFn: getAppointments,
})

const appointments = computed(() => appointmentsQuery.data.value ?? [])

const summary = computed(() => {
  const total = appointments.value.length
  const pending = countByStatus(appointments.value, ['PENDING', 'SCHEDULED'])
  const confirmed = countByStatus(appointments.value, ['CONFIRMED'])
  const completed = countByStatus(appointments.value, ['COMPLETED'])
  const cancelled = countByStatus(appointments.value, ['CANCELLED'])

  return {
    total,
    pending,
    confirmed,
    completed,
    cancelled,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
})

const appointmentsByStatus = computed(() => {
  const totals = new Map<string, number>()

  for (const appointment of appointments.value) {
    const status = normalizeStatus(appointment.status)
    totals.set(status, (totals.get(status) ?? 0) + 1)
  }

  return [...totals.entries()]
    .map(([status, total]) => ({
      status,
      label: statusLabel(status),
      total,
    }))
    .sort((a, b) => b.total - a.total)
})

const completedByType = computed(() => {
  const totals = new Map<string, number>()

  for (const appointment of appointments.value) {
    if (normalizeStatus(appointment.status) !== 'COMPLETED') continue

    const type = appointmentType(appointment)
    totals.set(type, (totals.get(type) ?? 0) + 1)
  }

  return [...totals.entries()]
    .map(([type, total]) => ({ type, total }))
    .sort((a, b) => b.total - a.total || a.type.localeCompare(b.type))
})

function countByStatus(appointments: Appointment[], statuses: string[]) {
  return appointments.filter((appointment) =>
    statuses.includes(normalizeStatus(appointment.status)),
  ).length
}

function normalizeStatus(status: string) {
  return status.toUpperCase()
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendientes',
    SCHEDULED: 'Agendadas',
    CONFIRMED: 'Confirmadas',
    CANCELLED: 'Canceladas',
    COMPLETED: 'Completadas',
    NO_SHOW: 'No asistieron',
  }

  return labels[normalizeStatus(status)] ?? status
}

function appointmentType(appointment: Appointment) {
  return appointment.reason?.trim() || 'Cita odontológica'
}

function buildCsv() {
  const rows = [
    ['seccion', 'categoria', 'total'],
    ...appointmentsByStatus.value.map((item) => [
      'estado',
      item.label,
      String(item.total),
    ]),
    ...completedByType.value.map((item) => [
      'completadas_por_tipo',
      item.type,
      String(item.total),
    ]),
  ]

  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

function downloadCsv() {
  const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'dashboard-citas-dentista.csv'
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

    <p v-if="appointmentsQuery.isLoading.value">Cargando indicadores...</p>

    <p v-else-if="appointmentsQuery.isError.value" class="error-message">
      No se pudieron cargar tus indicadores.
    </p>

    <template v-else>
      <div class="cards-grid">
        <article class="card metric-card">
          <p>Citas totales</p>
          <h3>{{ summary.total }}</h3>
        </article>
        <article class="card metric-card">
          <p>Confirmadas</p>
          <h3>{{ summary.confirmed }}</h3>
        </article>
        <article class="card metric-card">
          <p>Completadas</p>
          <h3>{{ summary.completed }}</h3>
        </article>
        <article class="card metric-card">
          <p>Efectividad</p>
          <h3>{{ summary.completionRate }}%</h3>
        </article>
      </div>

      <div class="section-block">
        <h3>Distribución de citas</h3>

        <div v-if="appointmentsByStatus.length" class="list">
          <div
            v-for="item in appointmentsByStatus"
            :key="item.status"
            class="list-item"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.total }}</strong>
          </div>
        </div>

        <div v-else class="empty-state">
          Todavía no hay datos para mostrar.
        </div>
      </div>

      <div class="section-block">
        <h3>Citas completadas por tipo</h3>

        <div v-if="completedByType.length" class="list">
          <div
            v-for="item in completedByType"
            :key="item.type"
            class="list-item"
          >
            <span>{{ item.type }}</span>
            <strong>{{ item.total }}</strong>
          </div>
        </div>

        <div v-else class="empty-state">
          Todavía no hay citas completadas.
        </div>
      </div>
    </template>
  </AppLayout>
</template>
