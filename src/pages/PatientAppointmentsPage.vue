<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  getAppointmentAvailability,
  getAppointments,
  rateAppointment,
  rescheduleAppointment,
  type Appointment,
} from '../modules/appointments/appointments.api'
import { getDentists } from '../modules/dentists/dentists.service'
import type { Dentist } from '../modules/dentists/dentists.types'

const queryClient = useQueryClient()

const rescheduleTarget = ref<Appointment | null>(null)
const rescheduleDate = ref('')
const rescheduleTime = ref('')
const rescheduleReason = ref('')
const rescheduleNotes = ref('')
const ratingTarget = ref<Appointment | null>(null)
const ratingScore = ref(5)
const ratingComment = ref('')
const today = getLocalDateValue()
const rescheduleError = ref('')
const rescheduleMinTime = computed(
  () => (rescheduleDate.value === today ? getLocalTimeValue() : undefined),
)
const isRescheduleDatePast = computed(
  () => Boolean(rescheduleDate.value) && isBeforeToday(rescheduleDate.value),
)

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
})

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: getDentists,
})

const rescheduleAvailabilityQuery = useQuery({
  queryKey: [
    'appointments',
    'availability',
    computed(() => rescheduleTarget.value?.dentistId),
    rescheduleDate,
  ],
  queryFn: () =>
    getAppointmentAvailability(
      rescheduleTarget.value!.dentistId,
      rescheduleDate.value,
    ),
  enabled: computed(
    () =>
      Boolean(rescheduleTarget.value?.dentistId && rescheduleDate.value) &&
      !isRescheduleDatePast.value,
  ),
})

const appointmentGroups = computed(() => {
  return groupAppointmentsByDay(appointmentsQuery.data.value ?? [])
})

const dentistNameById = computed(() => {
  return new Map(
    (dentistsQuery.data.value ?? []).map((dentist) => [
      dentist.domainId,
      dentistName(dentist),
    ]),
  )
})

const rescheduleAvailabilitySlots = computed(() => {
  const value = rescheduleAvailabilityQuery.data.value
  const now = Date.now()

  if (Array.isArray(value)) {
    return value.filter((slot) => !isPastSlot(slot, now))
  }

  if (value && typeof value === 'object' && 'slots' in value) {
    const slots = (value as { slots?: unknown }).slots
    return Array.isArray(slots)
      ? slots.filter((slot) => !isPastSlot(slot, now))
      : []
  }

  return []
})

const cancelMutation = useMutation({
  mutationFn: cancelAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const rescheduleMutation = useMutation({
  mutationFn: rescheduleAppointment,
  onSuccess: () => {
    rescheduleTarget.value = null
    rescheduleReason.value = ''
    rescheduleNotes.value = ''
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const ratingMutation = useMutation({
  mutationFn: rateAppointment,
  onSuccess: () => {
    ratingTarget.value = null
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

watch(rescheduleDate, (date) => {
  rescheduleError.value = ''
  rescheduleTime.value = ''

  if (date && isBeforeToday(date)) {
    rescheduleDate.value = today
  }
})

watch(rescheduleTime, (time) => {
  if (time && isSelectedTimePast(rescheduleDate.value, time)) {
    rescheduleTime.value = ''
  }
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

function groupAppointmentsByDay(appointments: Appointment[]) {
  const sorted = [...appointments].sort((a, b) => {
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })

  return sorted.reduce<Array<{ key: string; label: string; appointments: Appointment[] }>>(
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

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? dentist.domainId
}

function dentistDisplayName(dentistId: string) {
  return dentistNameById.value.get(dentistId) ?? dentistId
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getLocalTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function isBeforeToday(date: string) {
  return date < getLocalDateValue()
}

function isSelectedTimePast(date: string, time: string) {
  if (!date || !time) return false

  const selectedDate = new Date(`${date}T${time}:00`)
  return Number.isNaN(selectedDate.getTime()) || selectedDate.getTime() <= Date.now()
}

function slotLabel(slot: unknown) {
  if (typeof slot === 'string') return slot

  const value = slot as { startAt?: string; label?: string }

  if (value.label) return value.label
  if (!value.startAt) return 'Horario disponible'

  return new Date(value.startAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function slotTime(slot: unknown) {
  if (typeof slot === 'string') return slot

  const value = slot as { startAt?: string }
  if (!value.startAt) return ''

  const date = new Date(value.startAt)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function isPastSlot(slot: unknown, now = Date.now()) {
  if (typeof slot === 'string') {
    if (!rescheduleDate.value) return false
    return new Date(`${rescheduleDate.value}T${slot}:00`).getTime() <= now
  }

  const value = slot as { startAt?: string; available?: boolean }
  if (value.available === false) return true
  if (!value.startAt) return false

  return new Date(value.startAt).getTime() <= now
}

function canCancel(appointment: Appointment) {
  const status = normalizeStatus(appointment.status)
  return status !== 'CANCELLED' && status !== 'COMPLETED'
}

function canReschedule(appointment: Appointment) {
  const status = normalizeStatus(appointment.status)
  return (
    (status === 'PENDING' || status === 'CONFIRMED') &&
    new Date(appointment.startAt).getTime() > Date.now()
  )
}

function canRate(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'COMPLETED'
}

async function handleCancel(id: string) {
  const confirmed = window.confirm('¿Cancelar esta cita?')
  if (!confirmed) return

  await cancelMutation.mutateAsync(id)
}

function openReschedule(appointment: Appointment) {
  rescheduleTarget.value = appointment
  const date = new Date(appointment.startAt)
  rescheduleDate.value = getLocalDateValue(date)
  rescheduleTime.value = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
  rescheduleReason.value = appointment.reason ?? ''
  rescheduleNotes.value = appointment.notes ?? ''
  rescheduleError.value = ''
}

function closeReschedule() {
  rescheduleTarget.value = null
  rescheduleDate.value = ''
  rescheduleTime.value = ''
  rescheduleReason.value = ''
  rescheduleNotes.value = ''
  rescheduleError.value = ''
}

async function submitReschedule() {
  rescheduleError.value = ''

  if (!rescheduleTarget.value || !rescheduleDate.value || !rescheduleTime.value) {
    return
  }

  if (isBeforeToday(rescheduleDate.value)) {
    rescheduleError.value = 'Elige una fecha a partir de hoy.'
    return
  }

  const start = new Date(`${rescheduleDate.value}T${rescheduleTime.value}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  if (isSelectedTimePast(rescheduleDate.value, rescheduleTime.value)) {
    rescheduleError.value = 'Elige una hora posterior al momento actual.'
    return
  }

  try {
    await rescheduleMutation.mutateAsync({
      id: rescheduleTarget.value.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: rescheduleReason.value || undefined,
      notes: rescheduleNotes.value || undefined,
    })
  } catch (error: any) {
    const message = error.response?.data?.message ?? error.response?.data?.error
    rescheduleError.value =
      typeof message === 'string' && message.includes('startAt must be in the future')
        ? 'Elige una fecha y hora posteriores al momento actual.'
        : 'No se pudo reprogramar la cita. Revisa la fecha y la disponibilidad.'
  }
}

function openRating(appointment: Appointment) {
  ratingTarget.value = appointment
  ratingScore.value = 5
  ratingComment.value = ''
}

async function submitRating() {
  if (!ratingTarget.value) return

  await ratingMutation.mutateAsync({
    appointmentId: ratingTarget.value.id,
    score: ratingScore.value,
    comment: ratingComment.value || undefined,
  })
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Paciente</p>
        <h2>Mis citas</h2>
      </div>
    </div>

    <p v-if="appointmentsQuery.isLoading.value">Cargando citas...</p>

    <p v-else-if="appointmentsQuery.isError.value" class="error-message">
      No se pudieron cargar tus citas.
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
                <span>Dentista</span>
                <strong>{{ dentistDisplayName(appointment.dentistId) }}</strong>
              </div>

              <p v-if="appointment.notes" class="agenda-notes">
                {{ appointment.notes }}
              </p>

              <div class="card-actions">
                <button
                  v-if="canReschedule(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  :disabled="rescheduleMutation.isPending.value"
                  @click="openReschedule(appointment)"
                >
                  Reprogramar
                </button>

                <button
                  v-if="canRate(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  :disabled="ratingMutation.isPending.value"
                  @click="openRating(appointment)"
                >
                  Valorar
                </button>

                <button
                  v-if="canCancel(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  :disabled="cancelMutation.isPending.value"
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
      Todavía no tienes citas agendadas.
    </div>

    <div v-if="rescheduleTarget" class="modal-backdrop" @click.self="closeReschedule">
      <section class="modal-panel appointment-modal-panel" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Reprogramar</p>
            <h2>{{ dentistDisplayName(rescheduleTarget.dentistId) }}</h2>
            <p class="muted-text">{{ rescheduleTarget.reason ?? 'Cita odontológica' }}</p>
          </div>
          <button class="secondary-button inline-button" type="button" @click="closeReschedule">
            Cerrar
          </button>
        </div>

        <form @submit.prevent="submitReschedule">
        <label>
          Fecha
          <input v-model="rescheduleDate" type="date" :min="today" required />
        </label>
        <label v-if="rescheduleAvailabilitySlots.length">
          Hora
          <select v-model="rescheduleTime" :disabled="!rescheduleDate">
            <option value="">Selecciona un horario</option>
            <option
              v-for="slot in rescheduleAvailabilitySlots"
              :key="slotLabel(slot)"
              :value="slotTime(slot)"
            >
              {{ slotLabel(slot) }}
            </option>
          </select>
        </label>
        <label v-else>
          Hora
          <input
            v-model="rescheduleTime"
            type="time"
            :disabled="!rescheduleDate"
            :min="rescheduleMinTime"
            required
          />
        </label>
        <label>
          Motivo
          <input v-model="rescheduleReason" type="text" placeholder="Consulta general" />
        </label>
        <label>
          Notas
          <textarea v-model="rescheduleNotes" rows="3" placeholder="Notas opcionales" />
        </label>
        <p v-if="rescheduleAvailabilityQuery.isError.value" class="error-message">
          No se pudo consultar disponibilidad; puedes elegir fecha y volver a intentar.
        </p>
        <p v-if="rescheduleError" class="error-message">{{ rescheduleError }}</p>
        <button class="primary-button" type="submit" :disabled="rescheduleMutation.isPending.value">
          Guardar cambio
        </button>
        </form>
      </section>
    </div>

    <div v-if="ratingTarget" class="card section-card">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Valoración</p>
          <h2>{{ ratingTarget.reason ?? 'Cita odontológica' }}</h2>
        </div>
        <button class="secondary-button inline-button" type="button" @click="ratingTarget = null">
          Cerrar
        </button>
      </div>

      <form @submit.prevent="submitRating">
        <label>
          Calificación
          <select v-model.number="ratingScore">
            <option :value="5">5</option>
            <option :value="4">4</option>
            <option :value="3">3</option>
            <option :value="2">2</option>
            <option :value="1">1</option>
          </select>
        </label>
        <label>
          Comentario
          <textarea v-model="ratingComment" rows="3" placeholder="Cuéntanos cómo fue tu atención" />
        </label>
        <button class="primary-button" type="submit" :disabled="ratingMutation.isPending.value">
          Enviar valoración
        </button>
      </form>
    </div>
  </AppLayout>
</template>
