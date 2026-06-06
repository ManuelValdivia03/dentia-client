<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointments,
  getDentistDayAgenda,
  type Appointment,
} from '../modules/appointments/appointments.api'
import { createPrescription } from '../modules/prescriptions/prescriptions.api'
import {
  getUserByDomainId,
  userDisplayName,
} from '../modules/users/users.api'
import { useRoute, useRouter } from 'vue-router'

const queryClient = useQueryClient()

const selectedDate = ref(getLocalDateValue(new Date()))
const calendarInputRef = ref<HTMLInputElement | null>(null)
const prescriptionTarget = ref<Appointment | null>(null)
const diagnosis = ref('')
const indications = ref('')
const prescriptionNotes = ref('')
const appointmentActionErrors = ref<Record<string, string>>({})
const prescriptionError = ref('')
const route = useRoute()
const router = useRouter()

const showAllAppointments = ref(
  route.query.scope === 'all',
)

watch(
  () => route.query.scope,
  (scope) => {
    showAllAppointments.value = scope === 'all'
  },
)

const selectedStatus = ref(
  typeof route.query.status === 'string'
    ? normalizeStatus(route.query.status)
    : '',
)

watch(
  () => route.query.status,
  (status) => {
    selectedStatus.value =
      typeof status === 'string' ? normalizeStatus(status) : ''
  },
)

const appointmentsQuery = useQuery({
  queryKey: computed(() => [
    'appointments',
    'dentist-agenda',
    showAllAppointments.value ? 'all' : selectedDate.value,
  ]),
  queryFn: () => {
    if (showAllAppointments.value) {
      return getAppointments()
    }

    return getDentistDayAgenda(selectedDate.value)
  },
})

const selectedDateLabel = computed(() => formatAgendaDate(selectedDate.value))

const confirmMutation = useMutation({
  mutationFn: confirmAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const completeMutation = useMutation({
  mutationFn: completeAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const cancelMutation = useMutation({
  mutationFn: cancelAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const prescriptionMutation = useMutation({
  mutationFn: createPrescription,
  onSuccess: () => {
    prescriptionTarget.value = null
    diagnosis.value = ''
    indications.value = ''
    prescriptionNotes.value = ''
  },
})

const appointments = computed(() => {
  const status = selectedStatus.value

  return [...(appointmentsQuery.data.value ?? [])]
    .filter((appointment) => {
      if (!status) return true
      return normalizeStatus(appointment.status) === status
    })
    .sort((a, b) => {
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    })
})

const appointmentGroups = computed(() => {
  return groupAppointmentsByDay(appointments.value)
})

const patientIds = computed(() => {
  return [...new Set(appointments.value.map((appointment) => appointment.patientId))]
})

const patientsQuery = useQuery({
  queryKey: computed(() => ['users', 'appointment-patients', patientIds.value]),
  queryFn: async () => {
    const patients = await Promise.all(
      patientIds.value.map((patientId) => getUserByDomainId(patientId)),
    )

    return patients
  },
  enabled: computed(() => patientIds.value.length > 0),
})

const patientNameById = computed(() => {
  return new Map(
    (patientsQuery.data.value ?? []).map((patient) => [
      patient.domainId,
      userDisplayName(patient),
    ]),
  )
})

function normalizeStatus(status: string) {
  return status.toUpperCase()
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendientes',
    CONFIRMED: 'Confirmadas',
    CANCELLED: 'Canceladas',
    COMPLETED: 'Completadas',
  }

  return labels[normalizeStatus(status)] ?? status
}

function statusClass(status: string) {
  return `status-${normalizeStatus(status).toLowerCase()}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatAgendaDate(value: string) {
  const date = parseLocalDateValue(value)

  const weekday = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
  }).format(date)

  const day = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
  }).format(date)

  const month = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
  }).format(date)

  return `${weekday} ${day} de ${capitalize(month)}`
}

function formatDay(value: string) {
  return formatAgendaDate(getLocalDateValue(new Date(value)))
}

const statusFilterOptions = [
  { value: '', label: 'Todas' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

function updateStatusFilter(status: string) {
  selectedStatus.value = status

  router.replace({
    query: {
      ...route.query,
      scope: showAllAppointments.value ? 'all' : undefined,
      status: status || undefined,
    },
  })
}


function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeRange(appointment: Appointment) {
  return `${formatTime(appointment.startAt)} - ${formatTime(appointment.endAt)}`
}

function getLocalDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number) {
  const date = parseLocalDateValue(value)
  date.setDate(date.getDate() + days)
  return getLocalDateValue(date)
}

function goToPreviousDate() {
  selectedDate.value = addDays(selectedDate.value, -1)
  showAllAppointments.value = false

  router.replace({
    query: {
      ...route.query,
      scope: undefined,
    },
  })
}

function goToNextDate() {
  selectedDate.value = addDays(selectedDate.value, 1)
  showAllAppointments.value = false

  router.replace({
    query: {
      ...route.query,
      scope: undefined,
    },
  })
}

function handleCalendarChange() {
  showAllAppointments.value = false

  router.replace({
    query: {
      ...route.query,
      scope: undefined,
    },
  })
}

function openCalendar() {
  calendarInputRef.value?.showPicker?.()
  calendarInputRef.value?.click()
}

function toggleShowAllAppointments() {
  showAllAppointments.value = !showAllAppointments.value

  router.replace({
    query: {
      ...route.query,
      scope: showAllAppointments.value ? 'all' : undefined,
    },
  })
}

function groupAppointmentsByDay(appointments: Appointment[]) {
  return appointments.reduce<Array<{ key: string; label: string; appointments: Appointment[] }>>(
    (groups, appointment) => {
      const key = getLocalDateValue(new Date(appointment.startAt))
      const existingGroup = groups.find((group) => group.key === key)

      if (existingGroup) {
        existingGroup.appointments.push(appointment)
      } else {
        groups.push({
          key,
          label: formatDay(appointment.startAt),
          appointments: [appointment],
        })
      }

      return groups
    },
    [],
  )
}

function appointmentCountLabel(count: number) {
  return count === 1 ? '1 cita' : `${count} citas`
}

function patientDisplayName(patientId: string) {
  if (patientsQuery.isLoading.value || patientsQuery.isFetching.value) {
    return 'Cargando paciente...'
  }

  return patientNameById.value.get(patientId) ?? 'Paciente no disponible'
}

function canConfirm(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'PENDING'
}

function canComplete(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'CONFIRMED'
}

function canCompleteNow(appointment: Appointment) {
  return new Date(appointment.startAt).getTime() <= Date.now()
}

function completionBlockedMessage(appointment: Appointment) {
  if (normalizeStatus(appointment.status) !== 'CONFIRMED' || canCompleteNow(appointment)) {
    return ''
  }

  return `Podrás completarla a partir de ${formatTime(appointment.startAt)}.`
}

function canCancel(appointment: Appointment) {
  const status = normalizeStatus(appointment.status)
  return status !== 'CANCELLED' && status !== 'COMPLETED'
}

function canPrescribe(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'COMPLETED'
}

async function handleConfirm(id: string) {
  clearActionError(id)

  try {
    await confirmMutation.mutateAsync(id)
  } catch (error) {
    setActionError(id, getActionErrorMessage(error))
  }
}

async function handleComplete(appointment: Appointment) {
  clearActionError(appointment.id)

  if (!canCompleteNow(appointment)) {
    setActionError(appointment.id, completionBlockedMessage(appointment))
    return
  }

  const confirmed = window.confirm('¿Marcar esta cita como completada?')
  if (!confirmed) return

  try {
    await completeMutation.mutateAsync(appointment.id)
  } catch (error) {
    setActionError(appointment.id, getActionErrorMessage(error))
  }
}

async function handleCancel(id: string) {
  clearActionError(id)
  const confirmed = window.confirm('¿Cancelar esta cita?')
  if (!confirmed) return

  try {
    await cancelMutation.mutateAsync(id)
  } catch (error) {
    setActionError(id, getActionErrorMessage(error))
  }
}

function setActionError(appointmentId: string, message: string) {
  appointmentActionErrors.value = {
    ...appointmentActionErrors.value,
    [appointmentId]: message,
  }
}

function clearActionError(appointmentId: string) {
  const nextErrors = { ...appointmentActionErrors.value }
  delete nextErrors[appointmentId]
  appointmentActionErrors.value = nextErrors
}

function getActionErrorMessage(error: unknown) {
  const message =
    typeof error === 'object' && error && 'response' in error
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined

  if (message === 'Appointment cannot be completed before its start time') {
    return 'Todavía no puedes completar esta cita porque aún no llega su fecha y hora.'
  }

  return message ?? 'No se pudo completar la acción. Intenta de nuevo.'
}

function isBusy() {
  return (
    confirmMutation.isPending.value ||
    completeMutation.isPending.value ||
    cancelMutation.isPending.value
  )
}

function openPrescription(appointment: Appointment) {
  if (!canPrescribe(appointment)) {
    setActionError(
      appointment.id,
      'Solo se pueden crear recetas para citas completadas.',
    )
    return
  }

  prescriptionTarget.value = appointment
  diagnosis.value = ''
  indications.value = ''
  prescriptionNotes.value = ''
  prescriptionError.value = ''
}

async function submitPrescription() {
  if (!prescriptionTarget.value) return

  prescriptionError.value = ''

  try {
    await prescriptionMutation.mutateAsync({
      appointmentId: prescriptionTarget.value.id,
      patientId: prescriptionTarget.value.patientId,
      dentistId: prescriptionTarget.value.dentistId,
      diagnosis: diagnosis.value,
      indications: indications.value,
      notes: prescriptionNotes.value || undefined,
    })
  } catch (error) {
    prescriptionError.value = getActionErrorMessage(error)
  }
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Odontólogo</p>
        <h2>Mi agenda</h2>
      </div>

      <div class="agenda-date-controls" aria-label="Controles de fecha de agenda">
        <button
          class="date-nav-button"
          type="button"
          aria-label="Día anterior"
          @click="goToPreviousDate"
        >
          ‹
        </button>

        <span class="selected-date-pill">
          {{ showAllAppointments ? 'Todas las citas' : selectedDateLabel }}
        </span>

        <button
          class="date-nav-button"
          type="button"
          aria-label="Día siguiente"
          @click="goToNextDate"
        >
          ›
        </button>

        <button class="secondary-button inline-button" type="button" @click="openCalendar">
          Calendario
        </button>

        <input
          ref="calendarInputRef"
          v-model="selectedDate"
          class="native-date-input"
          type="date"
          aria-label="Seleccionar fecha"
          @change="handleCalendarChange"
        />

        <button class="secondary-button inline-button" type="button" @click="toggleShowAllAppointments">
          {{ showAllAppointments ? 'Ver por fecha' : 'Ver todas' }}
        </button>
      </div>
    </div>

    <p class="helper-text">
      Las solicitudes pendientes no bloquean definitivamente el horario hasta que confirmes una
    </p>

    <div class="agenda-filters">
      <button
        v-for="option in statusFilterOptions"
        :key="option.value || 'all'"
        class="filter-chip"
        :class="{ active: selectedStatus === option.value }"
        type="button"
        @click="updateStatusFilter(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="appointmentsQuery.isLoading.value || appointmentsQuery.isFetching.value">
      Cargando agenda...
    </p>

    <p v-else-if="appointmentsQuery.isError.value" class="error-message">
      No se pudo cargar la agenda.
    </p>

    <div v-else-if="appointmentGroups.length" class="agenda-board">
      <section
        v-for="group in appointmentGroups"
        :key="group.key"
        class="agenda-day"
      >
        <div class="agenda-day-header">
          <div>
            <p class="eyebrow">Día</p>
            <h3>{{ group.label }}</h3>
          </div>
          <span class="agenda-count">{{ appointmentCountLabel(group.appointments.length) }}</span>
        </div>

        <div class="agenda-list">
          <article
            v-for="appointment in group.appointments"
            :key="appointment.id"
            class="agenda-item"
            :class="statusClass(appointment.status)"
          >
            <div class="agenda-time">
              <strong>{{ formatTime(appointment.startAt) }}</strong>
              <span>{{ formatTime(appointment.endAt) }}</span>
            </div>

            <div class="agenda-card">
              <div class="agenda-card-header">
                <div>
                  <h3>{{ appointment.reason ?? 'Cita odontológica' }}</h3>
                  <p>{{ formatTimeRange(appointment) }}</p>
                </div>

                <span class="status-badge" :class="statusClass(appointment.status)">
                  {{ statusLabel(appointment.status) }}
                </span>

                <span
                  v-if="normalizeStatus(appointment.status) === 'PENDING'"
                  class="request-badge"
                >
                  Solicitud por confirmar
                </span>
              </div>

              <div class="agenda-meta">
                <span>Paciente</span>
                <strong>{{ patientDisplayName(appointment.patientId) }}</strong>
              </div>

              <p v-if="appointment.notes" class="agenda-notes">
                {{ appointment.notes }}
              </p>

              <p
                v-if="completionBlockedMessage(appointment) || appointmentActionErrors[appointment.id]"
                class="error-message"
              >
                {{ appointmentActionErrors[appointment.id] || completionBlockedMessage(appointment) }}
              </p>

              <div class="card-actions">
                <button
                  v-if="canConfirm(appointment)"
                  class="primary-button inline-button"
                  type="button"
                  :disabled="isBusy()"
                  @click="handleConfirm(appointment.id)"
                >
                  Confirmar
                </button>

                <button
                  v-if="canComplete(appointment)"
                  class="primary-button inline-button"
                  type="button"
                  :disabled="isBusy()"
                  @click="handleComplete(appointment)"
                >
                  Completar
                </button>

                <button
                  v-if="canPrescribe(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  @click="openPrescription(appointment)"
                >
                  Receta
                </button>

                <button
                  v-if="canCancel(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  :disabled="isBusy()"
                  @click="handleCancel(appointment.id)"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-else class="empty-state">
      {{
        selectedStatus
          ? `No tienes citas ${statusLabel(selectedStatus).toLowerCase()} ${showAllAppointments ? '' : 'para esta fecha'}.`
          : showAllAppointments
            ? 'No tienes citas asignadas.'
            : 'No tienes citas asignadas para esta fecha.'
      }}
    </div>

    <Teleport to="body">
      <div
        v-if="prescriptionTarget"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prescription-modal-title"
      >
        <section class="modal-card prescription-modal-card">
          <header class="modal-header">
            <div>
              <p class="eyebrow">Nueva receta</p>
              <h2 id="prescription-modal-title">
                {{ prescriptionTarget.reason ?? 'Cita odontológica' }}
              </h2>
            </div>
          </header>

          <form class="modal-form" @submit.prevent="submitPrescription">
            <label>
              Diagnóstico
              <input v-model="diagnosis" required />
            </label>

            <label>
              Indicaciones
              <textarea v-model="indications" rows="3" required />
            </label>

            <label>
              Notas
              <textarea v-model="prescriptionNotes" rows="3" />
            </label>

            <p v-if="prescriptionError" class="error-message">
              {{ prescriptionError }}
            </p>

            <div class="modal-actions">
              <button
                class="modal-action-button modal-action-secondary"
                type="button"
                @click="prescriptionTarget = null"
              >
                Cancelar
              </button>

              <button
                class="modal-action-button modal-action-primary"
                type="submit"
                :disabled="prescriptionMutation.isPending.value"
              >
                {{ prescriptionMutation.isPending.value ? 'Guardando...' : 'Guardar receta' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </AppLayout>
</template>

<style scoped>

.agenda-date-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.date-nav-button {
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.date-nav-button:hover {
  border-color: #0f766e;
  color: #0f766e;
}

.selected-date-pill {
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0.55rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #0f172a;
  font-weight: 800;
}

.native-date-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.request-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 0.78rem;
  font-weight: 700;
}

.helper-text {
  margin: -0.5rem 0 1rem;
  color: #64748b;
  font-size: 0.95rem;
}

.agenda-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 1rem 0;
}

.filter-chip {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  border-radius: 999px;
  padding: 0.45rem 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.filter-chip.active {
  border-color: #0f766e;
  background: #e6f7f2;
  color: #0f766e;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgb(15 23 42 / 0.55);
}

.modal-card {
  width: min(100%, 620px);
  border-radius: 24px;
  background: #fff;
  padding: 1.5rem;
  box-shadow: 0 24px 80px rgb(15 23 42 / 0.25);
}

.prescription-modal-card {
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  margin-bottom: 1rem;
}

.modal-form {
  display: grid;
  gap: 1rem;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.modal-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 4rem;
  border-radius: 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.modal-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 4rem;
  border-radius: 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.modal-action-secondary {
  border: 1px solid #d8e2ec;
  background: #fff;
  color: #172033;
}

.modal-action-primary {
  border: 1px solid #0f6b85;
  background: #0f6b85;
  color: #fff;
}

.modal-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

</style>