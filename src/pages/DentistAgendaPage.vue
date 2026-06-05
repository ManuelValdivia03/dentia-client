<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
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

const selectedDate = ref(new Date().toISOString().slice(0, 10))
const prescriptionTarget = ref<Appointment | null>(null)
const diagnosis = ref('')
const indications = ref('')
const prescriptionNotes = ref('')
const appointmentActionErrors = ref<Record<string, string>>({})
const prescriptionError = ref('')
const route = useRoute()
const router = useRouter()

const appointmentsQuery = useQuery({
  queryKey: computed(() => ['appointments', 'day', selectedDate.value]),
  queryFn: () => getDentistDayAgenda(selectedDate.value),
})

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
  return [...(appointmentsQuery.data.value ?? [])]
    .filter((appointment) => {
      if (!selectedStatus.value) return true
      return normalizeStatus(appointment.status) === selectedStatus.value
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
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    COMPLETED: 'Completada',
  }

  return labels[normalizeStatus(status)] ?? status
}

function statusClass(status: string) {
  return `status-${normalizeStatus(status).toLowerCase()}`
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
      status: status || undefined,
    },
  })
}

const selectedStatus = ref(
  typeof route.query.status === 'string' ? route.query.status.toUpperCase() : '',
)

watch(
  () => route.query.status,
  (status) => {
    selectedStatus.value = typeof status === 'string' ? status.toUpperCase() : ''
  },
)

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

      <label class="date-filter">
        Fecha
        <input v-model="selectedDate" type="date" />
      </label>
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
          ? `No tienes citas ${statusLabel(selectedStatus).toLowerCase()} para esta fecha.`
          : 'No tienes citas asignadas para esta fecha.'
      }}
    </div>

    <div v-if="prescriptionTarget" class="card section-card">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Nueva receta</p>
          <h2>{{ prescriptionTarget.reason ?? 'Cita odontológica' }}</h2>
        </div>

        <button class="secondary-button inline-button" type="button" @click="prescriptionTarget = null">
          Cerrar
        </button>
      </div>

      <form @submit.prevent="submitPrescription">
        <label>
          Diagnóstico
          <textarea v-model="diagnosis" rows="3" required />
        </label>

        <label>
          Indicaciones
          <textarea v-model="indications" rows="4" required />
        </label>

        <label>
          Notas
          <textarea v-model="prescriptionNotes" rows="3" />
        </label>

        <p v-if="prescriptionError" class="error-message">
          {{ prescriptionError }}
        </p>

        <button class="primary-button" type="submit" :disabled="prescriptionMutation.isPending.value">
          Guardar receta
        </button>
      </form>
    </div>
  </AppLayout>
</template>

<style scoped>
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
</style>