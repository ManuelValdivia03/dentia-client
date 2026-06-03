<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointments,
  type Appointment,
} from '../modules/appointments/appointments.api'
import { createPrescription } from '../modules/prescriptions/prescriptions.api'
import {
  getUserByDomainId,
  userDisplayName,
} from '../modules/users/users.api'

const queryClient = useQueryClient()

const prescriptionTarget = ref<Appointment | null>(null)
const diagnosis = ref('')
const indications = ref('')
const prescriptionNotes = ref('')

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
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
  return [...(appointmentsQuery.data.value ?? [])].sort((a, b) => {
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
  queryKey: ['users', 'appointment-patients', patientIds],
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
  return patientNameById.value.get(patientId) ?? patientId
}

function canConfirm(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'PENDING'
}

function canComplete(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'CONFIRMED'
}

function canCancel(appointment: Appointment) {
  const status = normalizeStatus(appointment.status)
  return status !== 'CANCELLED' && status !== 'COMPLETED'
}

function canPrescribe(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'COMPLETED'
}

async function handleConfirm(id: string) {
  await confirmMutation.mutateAsync(id)
}

async function handleComplete(id: string) {
  const confirmed = window.confirm('¿Marcar esta cita como completada?')
  if (!confirmed) return

  await completeMutation.mutateAsync(id)
}

async function handleCancel(id: string) {
  const confirmed = window.confirm('¿Cancelar esta cita?')
  if (!confirmed) return

  await cancelMutation.mutateAsync(id)
}

function isBusy() {
  return (
    confirmMutation.isPending.value ||
    completeMutation.isPending.value ||
    cancelMutation.isPending.value
  )
}

function openPrescription(appointment: Appointment) {
  prescriptionTarget.value = appointment
  diagnosis.value = ''
  indications.value = ''
  prescriptionNotes.value = ''
}

async function submitPrescription() {
  if (!prescriptionTarget.value) return

  await prescriptionMutation.mutateAsync({
    appointmentId: prescriptionTarget.value.id,
    patientId: prescriptionTarget.value.patientId,
    dentistId: prescriptionTarget.value.dentistId,
    diagnosis: diagnosis.value,
    indications: indications.value,
    notes: prescriptionNotes.value || undefined,
  })
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Odontólogo</p>
        <h2>Mi agenda</h2>
      </div>
    </div>

    <p v-if="appointmentsQuery.isLoading.value">Cargando agenda...</p>

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
              </div>

              <div class="agenda-meta">
                <span>Paciente</span>
                <strong>{{ patientDisplayName(appointment.patientId) }}</strong>
              </div>

              <p v-if="appointment.notes" class="agenda-notes">
                {{ appointment.notes }}
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
                  @click="handleComplete(appointment.id)"
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
      No tienes citas asignadas.
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

        <button class="primary-button" type="submit" :disabled="prescriptionMutation.isPending.value">
          Guardar receta
        </button>
      </form>
    </div>
  </AppLayout>
</template>
