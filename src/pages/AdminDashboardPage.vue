<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  getAppointmentsByStatus,
  getDashboardSummary,
} from '../modules/reports/reports.api'

type DashboardSummary = {
  total_appointments: number
  scheduled: number
  confirmed: number
  completed: number
  cancelled: number
  no_show?: number
  completion_rate: number
}

type StatusReportItem = {
  status: string
  total: number
}

type StatusReport = {
  data: StatusReportItem[]
}

type Dentist = {
  id?: string
  domainId: string
  fullName?: string
  email?: string
  specialty?: string
  cedulaProfesional?: string
  escuela?: string
  descripcion?: string
  profilePhotoUrl?: string
}

type Appointment = {
  id: string
  patientId?: string
  dentistId?: string
  startAt?: string
  endAt?: string
  status?: string
  reason?: string
}

const queryClient = useQueryClient()
const selectedDentistId = ref('')
const selectedDate = ref('')
const appointmentsError = ref('')

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? ''

function getAccessToken() {
  return (
    localStorage.getItem('accessToken') ??
    localStorage.getItem('dentia_access_token') ??
    localStorage.getItem('token') ??
    ''
  )
}

function buildHeaders(optionsHeaders?: HeadersInit): Headers {
  const headers = new Headers(optionsHeaders)
  const token = getAccessToken()

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`)
  }

  return headers
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options.headers),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `Error HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}

function reportDoctorId() {
  return selectedDentistId.value || undefined
}

async function getDashboardSummaryForAdmin() {
  return (getDashboardSummary as unknown as (doctorId?: string) => Promise<DashboardSummary>)(
    reportDoctorId(),
  )
}

async function getAppointmentsByStatusForAdmin() {
  return (getAppointmentsByStatus as unknown as (doctorId?: string) => Promise<StatusReport>)(
    reportDoctorId(),
  )
}


async function getDentists() {
  return apiRequest<Dentist[]>('/dentists')
}

async function getAppointments() {
  const params = new URLSearchParams()

  if (selectedDate.value) {
    params.set('date', selectedDate.value)
  }

  if (selectedDentistId.value) {
    params.set('dentistId', selectedDentistId.value)
  }

  const path = selectedDate.value
    ? `/appointments/day?${params.toString()}`
    : '/appointments'

  const appointments = await apiRequest<Appointment[]>(path)

  if (!selectedDentistId.value || selectedDate.value) {
    return appointments
  }

  return appointments.filter((appointment) => appointment.dentistId === selectedDentistId.value)
}

async function updateAppointmentStatus(id: string, action: 'confirm' | 'cancel' | 'complete') {
  return apiRequest<Appointment>(`/appointments/${id}/${action}`, {
    method: 'PATCH',
  })
}

const dentistsQuery = useQuery({
  queryKey: ['admin', 'dentists'],
  queryFn: getDentists,
})

const summaryQuery = useQuery({
  queryKey: computed(() => ['reports', 'dashboard-summary', selectedDentistId.value]),
  queryFn: getDashboardSummaryForAdmin,
})

const statusQuery = useQuery({
  queryKey: computed(() => ['reports', 'appointments-by-status', selectedDentistId.value]),
  queryFn: getAppointmentsByStatusForAdmin,
})

const appointmentsQuery = useQuery({
  queryKey: computed(() => [
    'admin',
    'appointments',
    selectedDentistId.value,
    selectedDate.value,
  ]),
  queryFn: getAppointments,
})

const appointmentMutation = useMutation({
  mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'cancel' | 'complete' }) =>
    updateAppointmentStatus(id, action),
  onSuccess: () => {
    appointmentsError.value = ''
    queryClient.invalidateQueries({ queryKey: ['admin', 'appointments'] })
    queryClient.invalidateQueries({ queryKey: ['reports'] })
  },
  onError: (error) => {
    appointmentsError.value =
      error instanceof Error ? error.message : 'No se pudo actualizar la cita.'
  },
})

const selectedDentist = computed(() => {
  if (!selectedDentistId.value) {
    return null
  }

  return dentistsQuery.data.value?.find(
    (dentist) => dentist.domainId === selectedDentistId.value,
  )
})

const summaryCards = computed(() => {
  const summary = summaryQuery.data.value

  return [
    ['Citas totales', summary?.total_appointments ?? 0],
    ['Programadas', summary?.scheduled ?? 0],
    ['Confirmadas', summary?.confirmed ?? 0],
    ['Completadas', summary?.completed ?? 0],
    ['Canceladas', summary?.cancelled ?? 0],
    ['No asistieron', summary?.no_show ?? 0],
    ['Efectividad', `${summary?.completion_rate ?? 0}%`],
  ]
})

const totalStatusItems = computed(() => {
  return statusQuery.data.value?.data.reduce((total, item) => total + item.total, 0) ?? 0
})

function statusPercentageLabel(total: number) {
  if (totalStatusItems.value <= 0) {
    return '0%'
  }

  const percentage = (total / totalStatusItems.value) * 100
  return `${Number(percentage.toFixed(1))}%`
}

function csvValue(value: string | number) {
  const text = String(value)

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

const sortedAppointments = computed(() => {
  return [...(appointmentsQuery.data.value ?? [])].sort((a, b) => {
    const first = a.startAt ? new Date(a.startAt).getTime() : 0
    const second = b.startAt ? new Date(b.startAt).getTime() : 0
    return second - first
  })
})

function statusKey(status?: string) {
  return String(status ?? '').trim().toLowerCase()
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    scheduled: 'Programada',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No asistió',
  }

  return labels[statusKey(status)] ?? status ?? 'Sin estado'
}

function statusClass(status?: string) {
  return `status-${statusKey(status) || 'unknown'}`
}

function dentistName(dentistId?: string) {
  const dentist = dentistsQuery.data.value?.find((item) => item.domainId === dentistId)
  return dentist?.fullName ?? dentist?.email ?? dentistId ?? 'Sin dentista'
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function canConfirm(appointment: Appointment) {
  const status = statusKey(appointment.status)
  return status === 'pending' || status === 'scheduled'
}

function canCancel(appointment: Appointment) {
  const status = statusKey(appointment.status)
  return status !== 'cancelled' && status !== 'completed'
}

function canComplete(appointment: Appointment) {
  return statusKey(appointment.status) === 'confirmed'
}

function downloadCsv() {
  const rows = statusQuery.data.value?.data ?? []

  if (!rows.length) {
    return
  }

  const csvRows = [
    ['Estado', 'Total', 'Porcentaje'],
    ...rows.map((item) => [
      statusLabel(item.status),
      item.total,
      statusPercentageLabel(item.total),
    ]),
  ]

  const csv = csvRows
    .map((row) => row.map(csvValue).join(','))
    .join('\n')

  const blob = new Blob([`\ufeff${csv}\n`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const suffix = selectedDentistId.value ? `-${selectedDentistId.value}` : ''

  link.href = url
  link.download = `appointments-by-status${suffix}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function clearFilters() {
  selectedDentistId.value = ''
  selectedDate.value = ''
}
</script>

<template>
  <AppLayout>
    <div class="admin-dashboard">
      <header class="page-header admin-header">
        <div>
          <p class="eyebrow">Administrador</p>
          <h2>Panel administrativo</h2>
          <p class="page-description">
            Supervisa reportes, dentistas afiliados y operación de citas desde un solo panel.
          </p>

          <div class="header-actions">
            <button
              class="secondary-button inline-button"
              type="button"
              :disabled="!statusQuery.data.value?.data.length"
              @click="downloadCsv"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </header>

      <section class="filters-card">
        <div>
          <p class="eyebrow">Filtros administrativos</p>
          <h3>Vista general</h3>
        </div>

        <label class="field-control">
          <span>Dentista</span>
          <select v-model="selectedDentistId">
            <option value="">Todos los dentistas</option>
            <option
              v-for="dentist in dentistsQuery.data.value ?? []"
              :key="dentist.domainId"
              :value="dentist.domainId"
            >
              {{ dentist.fullName ?? dentist.email ?? dentist.domainId }}
            </option>
          </select>
        </label>

        <label class="field-control">
          <span>Fecha de agenda</span>
          <input v-model="selectedDate" type="date" />
        </label>

        <button class="ghost-button" type="button" @click="clearFilters">
          Limpiar filtros
        </button>
      </section>

      <p v-if="summaryQuery.isLoading.value" class="muted-message">Cargando reportes...</p>

      <p v-else-if="summaryQuery.isError.value" class="error-message">
        No se pudieron cargar los reportes.
      </p>

      <div v-else class="cards-grid metrics-grid">
        <article v-for="[label, value] in summaryCards" :key="label" class="card metric-card">
          <p>{{ label }}</p>
          <h3>{{ value }}</h3>
        </article>
      </div>

      <section class="admin-grid">
        <div class="section-block report-section">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Reportes</p>
              <h3>Citas por estado</h3>
            </div>
            <span v-if="selectedDentist" class="context-pill">
              {{ selectedDentist.fullName ?? selectedDentist.email }}
            </span>
          </div>

          <div v-if="statusQuery.data.value?.data.length" class="status-list">
            <div
              v-for="item in statusQuery.data.value.data"
              :key="item.status"
              class="status-row"
            >
              <div class="status-row-header">
                <span>{{ statusLabel(item.status) }}</span>
                <span class="status-values">
                  <strong>{{ item.total }}</strong>
                  <small>{{ statusPercentageLabel(item.total) }}</small>
                </span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar"
                  :style="{
                    width: totalStatusItems > 0 ? `${(item.total / totalStatusItems) * 100}%` : '0%',
                  }"
                />
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            Todavía no hay datos de citas para reportar.
          </div>
        </div>

        <div class="section-block dentists-section">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Directorio</p>
              <h3>Dentistas afiliados</h3>
            </div>
            <span class="context-pill">{{ dentistsQuery.data.value?.length ?? 0 }} activos</span>
          </div>

          <p v-if="dentistsQuery.isLoading.value" class="muted-message">Cargando dentistas...</p>

          <div v-else-if="dentistsQuery.data.value?.length" class="dentists-list">
            <article
              v-for="dentist in dentistsQuery.data.value"
              :key="dentist.domainId"
              class="dentist-card"
              :class="{ selected: dentist.domainId === selectedDentistId }"
            >
              <button type="button" @click="selectedDentistId = dentist.domainId">
                <span class="avatar-mini">
                  {{ (dentist.fullName ?? dentist.email ?? 'D').slice(0, 2).toUpperCase() }}
                </span>
                <span>
                  <strong>{{ dentist.fullName ?? 'Dentista sin nombre' }}</strong>
                  <small>{{ dentist.specialty ?? dentist.email ?? dentist.domainId }}</small>
                </span>
              </button>
            </article>
          </div>

          <div v-else class="empty-state">
            No hay dentistas afiliados para mostrar.
          </div>
        </div>
      </section>

      <section class="section-block appointments-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Operación</p>
            <h3>Gestión administrativa de citas</h3>
          </div>
          <span class="context-pill">{{ sortedAppointments.length }} registros</span>
        </div>

        <p v-if="appointmentsError" class="error-message">{{ appointmentsError }}</p>
        <p v-if="appointmentsQuery.isLoading.value" class="muted-message">Cargando citas...</p>

        <div v-else-if="sortedAppointments.length" class="table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Dentista</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th class="actions-column">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="appointment in sortedAppointments" :key="appointment.id">
                <td>{{ formatDateTime(appointment.startAt) }}</td>
                <td>{{ appointment.patientId ?? 'Sin paciente' }}</td>
                <td>{{ dentistName(appointment.dentistId) }}</td>
                <td>
                  <span class="status-badge" :class="statusClass(appointment.status)">
                    {{ statusLabel(appointment.status) }}
                  </span>
                </td>
                <td>{{ appointment.reason ?? 'Sin motivo' }}</td>
                <td class="actions-cell">
                  <button
                    v-if="canConfirm(appointment)"
                    class="tiny-button"
                    type="button"
                    :disabled="appointmentMutation.isPending.value"
                    @click="appointmentMutation.mutate({ id: appointment.id, action: 'confirm' })"
                  >
                    Confirmar
                  </button>
                  <button
                    v-if="canComplete(appointment)"
                    class="tiny-button"
                    type="button"
                    :disabled="appointmentMutation.isPending.value"
                    @click="appointmentMutation.mutate({ id: appointment.id, action: 'complete' })"
                  >
                    Completar
                  </button>
                  <button
                    v-if="canCancel(appointment)"
                    class="tiny-button danger"
                    type="button"
                    :disabled="appointmentMutation.isPending.value"
                    @click="appointmentMutation.mutate({ id: appointment.id, action: 'cancel' })"
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">
          No hay citas para los filtros seleccionados.
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-header {
  align-items: flex-start;
  gap: 1rem;
}

.page-description {
  color: #64748b;
  margin-top: 0.35rem;
  max-width: 720px;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  margin-top: 1rem;
}

.header-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.filters-card,
.section-block,
.card {
  background: #ffffff;
  border: 1px solid #e5edf4;
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.filters-card {
  display: grid;
  grid-template-columns: 1.2fr minmax(220px, 320px) minmax(180px, 240px) auto;
  align-items: end;
  gap: 1rem;
  padding: 1.25rem;
}

.field-control {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 700;
}

.field-control select,
.field-control input {
  border: 1px solid #d8e2ec;
  border-radius: 12px;
  color: #0f172a;
  min-height: 44px;
  padding: 0 0.85rem;
  outline: none;
}

.field-control select:focus,
.field-control input:focus {
  border-color: #176c84;
  box-shadow: 0 0 0 3px rgba(23, 108, 132, 0.12);
}

.ghost-button,
.tiny-button {
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
}

.ghost-button {
  background: #edf7fa;
  color: #176c84;
  min-height: 44px;
  padding: 0 1rem;
}

.metrics-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric-card {
  min-height: 112px;
}

.admin-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 1.5rem;
}

.section-block {
  padding: 1.25rem;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-heading h3 {
  margin: 0.15rem 0 0;
}

.context-pill {
  background: #edf7fa;
  border-radius: 999px;
  color: #176c84;
  font-size: 0.8rem;
  font-weight: 800;
  padding: 0.45rem 0.75rem;
  white-space: nowrap;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-row {
  border: 1px solid #e5edf4;
  border-radius: 14px;
  padding: 1rem;
}

.status-row-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.status-values {
  align-items: flex-end;
  display: inline-flex;
  flex-direction: column;
  gap: 0.1rem;
}

.status-values small {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 800;
}

.progress-track {
  background: #eaf2f7;
  border-radius: 999px;
  height: 10px;
  overflow: hidden;
}

.progress-bar {
  background: linear-gradient(90deg, #176c84, #65a98f);
  border-radius: inherit;
  height: 100%;
  min-width: 4px;
}

.dentists-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 380px;
  overflow: auto;
  padding-right: 0.25rem;
}

.dentist-card {
  border: 1px solid #e5edf4;
  border-radius: 14px;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.dentist-card.selected {
  background: #edf7fa;
  border-color: #176c84;
}

.dentist-card button {
  align-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  display: flex;
  gap: 0.75rem;
  padding: 0.85rem;
  text-align: left;
  width: 100%;
}

.avatar-mini {
  align-items: center;
  background: #176c84;
  border-radius: 999px;
  color: white;
  display: inline-flex;
  font-size: 0.8rem;
  font-weight: 900;
  height: 40px;
  justify-content: center;
  min-width: 40px;
}

.dentist-card small {
  color: #64748b;
  display: block;
  margin-top: 0.15rem;
}

.table-wrapper {
  overflow-x: auto;
}

.admin-table {
  border-collapse: collapse;
  width: 100%;
}

.admin-table th,
.admin-table td {
  border-bottom: 1px solid #e5edf4;
  padding: 0.95rem 0.75rem;
  text-align: left;
  vertical-align: middle;
}

.admin-table th {
  color: #64748b;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.actions-column,
.actions-cell {
  text-align: right;
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.tiny-button {
  background: #176c84;
  color: white;
  padding: 0.45rem 0.7rem;
}

.tiny-button.danger {
  background: #be3b3b;
}

.tiny-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.status-badge {
  border-radius: 999px;
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 900;
  padding: 0.35rem 0.7rem;
}

.status-pending,
.status-scheduled {
  background: #fff7df;
  color: #946200;
}

.status-confirmed {
  background: #e5f6ff;
  color: #075985;
}

.status-completed {
  background: #e7f8ef;
  color: #166534;
}

.status-cancelled,
.status-no_show {
  background: #fee2e2;
  color: #991b1b;
}

.status-unknown {
  background: #eef2f7;
  color: #475569;
}

.muted-message,
.empty-state {
  color: #64748b;
}

.empty-state {
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  padding: 1rem;
  text-align: center;
}

.error-message {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 14px;
  color: #be123c;
  padding: 0.9rem 1rem;
}

@media (max-width: 1180px) {
  .filters-card,
  .admin-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .section-heading,
  .admin-header {
    flex-direction: column;
  }
}
</style>
