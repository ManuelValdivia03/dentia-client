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

type AppointmentFilter =
  | 'all'
  | 'upcoming'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

const selectedAppointmentFilter = ref<AppointmentFilter>('all')

const appointmentFilterOptions: Array<{
  value: AppointmentFilter
  label: string
}> = [
  { value: 'all', label: 'Todas' },
  { value: 'upcoming', label: 'Próximas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
]

const rescheduleTarget = ref<Appointment | null>(null)
const rescheduleDate = ref('')
const rescheduleTime = ref('')
const rescheduleReason = ref('')
const rescheduleNotes = ref('')
const ratingTarget = ref<Appointment | null>(null)
const ratingScore = ref(5)
const ratingComment = ref('')
const ratedAppointmentIds = ref(new Set<string>())
const ratingOptions = [
  { value: 5, label: 'Excelente', icon: '★★★★★' },
  { value: 4, label: 'Buena', icon: '★★★★☆' },
  { value: 3, label: 'Regular', icon: '★★★☆☆' },
  { value: 2, label: 'Mala', icon: '★★☆☆☆' },
  { value: 1, label: 'Muy mala', icon: '★☆☆☆☆' },
]
const ratingError = ref('')
const ratingSuccess = ref('')
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

const appointments = computed(() => appointmentsQuery.data.value ?? [])

const filteredAppointments = computed(() => {
  return appointments.value.filter((appointment) => {
    const status = normalizeStatus(appointment.status)

    if (selectedAppointmentFilter.value === 'all') {
      return true
    }

    if (selectedAppointmentFilter.value === 'upcoming') {
      return (
        (status === 'PENDING' || status === 'CONFIRMED') &&
        new Date(appointment.startAt).getTime() >= Date.now()
      )
    }

    if (selectedAppointmentFilter.value === 'pending') {
      return status === 'PENDING'
    }

    if (selectedAppointmentFilter.value === 'confirmed') {
      return status === 'CONFIRMED'
    }

    if (selectedAppointmentFilter.value === 'completed') {
      return status === 'COMPLETED'
    }

    if (selectedAppointmentFilter.value === 'cancelled') {
      return status === 'CANCELLED'
    }

    return true
  })
})

const appointmentGroups = computed(() => {
  return groupAppointmentsByDay(filteredAppointments.value)
})

const emptyAppointmentsMessage = computed(() => {
  const labels: Record<AppointmentFilter, string> = {
    all: 'No tienes citas registradas.',
    upcoming: 'No tienes próximas citas.',
    pending: 'No tienes citas pendientes.',
    confirmed: 'No tienes citas confirmadas.',
    completed: 'No tienes citas completadas.',
    cancelled: 'No tienes citas canceladas.',
  }

  return labels[selectedAppointmentFilter.value]
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

  if (Array.isArray(value)) {
    return value.filter((slot) => !isPastSlot(slot))
  }

  if (value && typeof value === 'object' && 'slots' in value) {
    const slots = (value as { slots?: unknown }).slots
    return Array.isArray(slots)
      ? slots.filter((slot) => !isPastSlot(slot))
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
  const { year, month, day } = getMexicoDateTimeParts(date)

  return `${year}-${month}-${day}`
}

function getLocalTimeValue(date = new Date()) {
  const { hour, minute } = getMexicoDateTimeParts(date)

  return `${hour}:${minute}`
}

function getMexicoDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour') === '24' ? '00' : value('hour'),
    minute: value('minute'),
  }
}

function isBeforeToday(date: string) {
  return date < getLocalDateValue()
}

function isSelectedTimePast(date: string, time: string) {
  if (!date || !time) return false

  const today = getLocalDateValue()

  if (date < today) return true
  if (date > today) return false

  return time <= getLocalTimeValue()
}

function localDateTimeValue(date: string, time: string) {
  return `${date}T${time}:00`
}

function addMinutesToLocalDateTime(date: string, time: string, minutesToAdd: number) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutesToAdd))
  const nextDate = [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const nextTime = `${String(value.getUTCHours()).padStart(2, '0')}:${String(
    value.getUTCMinutes(),
  ).padStart(2, '0')}`

  return localDateTimeValue(nextDate, nextTime)
}

function slotLabel(slot: unknown) {
  if (typeof slot === 'string') return slot

  const value = slot as { startAt?: string; label?: string }

  if (value.label) return value.label
  if (!value.startAt) return 'Horario disponible'

  return timePartFromDateTime(value.startAt)
}

function slotTime(slot: unknown) {
  if (typeof slot === 'string') return slot

  const value = slot as { startAt?: string }
  if (!value.startAt) return ''

  return timePartFromDateTime(value.startAt)
}

function isPastSlot(slot: unknown) {
  if (typeof slot === 'string') {
    if (!rescheduleDate.value) return false
    return isSelectedTimePast(rescheduleDate.value, slot)
  }

  const value = slot as { startAt?: string; available?: boolean }
  if (value.available === false) return true
  if (!value.startAt) return false

  return isSelectedTimePast(
    datePartFromDateTime(value.startAt),
    timePartFromDateTime(value.startAt),
  )
}

function datePartFromDateTime(value: string) {
  return value.slice(0, 10)
}

function timePartFromDateTime(value: string) {
  return value.slice(11, 16)
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
  return (
    normalizeStatus(appointment.status) === 'COMPLETED' &&
    !appointment.hasRating &&
    !ratedAppointmentIds.value.has(appointment.id)
  )
}

function isRated(appointment: Appointment) {
  return Boolean(appointment.hasRating) || ratedAppointmentIds.value.has(appointment.id)
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

  if (isSelectedTimePast(rescheduleDate.value, rescheduleTime.value)) {
    rescheduleError.value = 'Elige una hora posterior al momento actual.'
    return
  }

  try {
    await rescheduleMutation.mutateAsync({
      id: rescheduleTarget.value.id,
      startAt: localDateTimeValue(rescheduleDate.value, rescheduleTime.value),
      endAt: addMinutesToLocalDateTime(rescheduleDate.value, rescheduleTime.value, 60),
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
  ratingError.value = ''
  ratingSuccess.value = ''
}

async function submitRating() {
  if (!ratingTarget.value) return

  const appointmentId = ratingTarget.value.id

  ratingError.value = ''
  ratingSuccess.value = ''

  try {
    await ratingMutation.mutateAsync({
      appointmentId,
      score: ratingScore.value,
      comment: ratingComment.value.trim() || undefined,
    })

    ratedAppointmentIds.value = new Set([
      ...ratedAppointmentIds.value,
      appointmentId,
    ])

    ratingSuccess.value = 'Valoración enviada correctamente.'
    ratingTarget.value = null
    ratingComment.value = ''
    ratingScore.value = 5

    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  } catch (error) {
    const message = getRatingErrorMessage(error)
    ratingError.value = message

    if (message === 'Esta cita ya fue valorada.') {
      ratedAppointmentIds.value = new Set([
        ...ratedAppointmentIds.value,
        appointmentId,
      ])
    }
  }
}

function getRatingErrorMessage(error: unknown) {
  const response =
    typeof error === 'object' && error && 'response' in error
      ? (error as { response?: { status?: number; data?: unknown } }).response
      : undefined

  const status = response?.status
  const data = response?.data

  const rawMessage =
    typeof data === 'string'
      ? data
      : data && typeof data === 'object' && 'message' in data
        ? (data as { message?: unknown }).message
        : data && typeof data === 'object' && 'error' in data
          ? (data as { error?: unknown }).error
          : undefined

  const message = Array.isArray(rawMessage)
    ? rawMessage.join(' ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : ''

  if (
    status === 409 ||
    message.includes('Appointment already has a rating') ||
    message.includes('already has a rating')
  ) {
    return 'Esta cita ya fue valorada.'
  }

  if (message.includes('Only completed appointments can be rated')) {
    return 'Solo puedes valorar citas completadas.'
  }

  if (message.includes('Patient can only rate own appointments')) {
    return 'No puedes valorar una cita que no te pertenece.'
  }

  if (
    message.includes('Score must be between 1 and 5') ||
    message.includes('score must be between 1 and 5')
  ) {
    return 'Selecciona una calificación válida.'
  }

  if (status === 400) {
    return 'No se pudo enviar la valoración. Revisa los datos e intenta nuevamente.'
  }

  return 'No se pudo enviar la valoración. Intenta nuevamente.'
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

    <div class="appointment-filters" role="tablist" aria-label="Filtros de citas">
      <button
        v-for="option in appointmentFilterOptions"
        :key="option.value"
        class="appointment-filter-button"
        :class="{
          'appointment-filter-button-active':
            selectedAppointmentFilter === option.value,
        }"
        type="button"
        @click="selectedAppointmentFilter = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="appointmentsQuery.isLoading.value">Cargando citas...</p>

    <p v-else-if="appointmentsQuery.isError.value" class="error-message">
      No se pudieron cargar tus citas.
    </p>

    <p v-if="!appointmentGroups.length" class="empty-message">
      {{ emptyAppointmentsMessage }}
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
                  v-if="canRate(appointment) || isRated(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  :disabled="ratingMutation.isPending.value || isRated(appointment)"
                  @click="openRating(appointment)"
                >
                  {{ isRated(appointment) ? 'Valorada' : 'Valorar' }}
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
      <Teleport to="body">
        <div
          v-if="ratingTarget"
          class="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rating-modal-title"
        >
          <section class="modal-card">
            <header class="modal-header">
              <div>
                <p class="eyebrow">Valorar</p>
                <h2 id="rating-modal-title">
                  {{ ratingTarget.reason ?? 'Cita odontológica' }}
                </h2>
              </div>
            </header>

            <form class="modal-form" @submit.prevent="submitRating">
              <div class="rating-field">
                <span class="rating-label">Calificación</span>

                <div class="rating-options">
                  <button
                    v-for="option in ratingOptions"
                    :key="option.value"
                    class="rating-option"
                    :class="{ 'rating-option-active': ratingScore === option.value }"
                    type="button"
                    @click="ratingScore = option.value"
                  >
                    <span class="rating-icon">{{ option.icon }}</span>
                    <span class="rating-text">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <label>
                Comentario
                <textarea
                  v-model="ratingComment"
                  rows="3"
                  placeholder="Cuéntanos cómo fue tu atención"
                />
              </label>

              <p v-if="ratingError" class="error-message">
                {{ ratingError }}
              </p>

              <div class="modal-actions">
                <button
                  class="modal-action-button modal-action-secondary"
                  type="button"
                  @click="ratingTarget = null"
                >
                  Cancelar
                </button>

                <button
                  class="modal-action-button modal-action-primary"
                  type="submit"
                  :disabled="ratingMutation.isPending.value"
                >
                  {{ ratingMutation.isPending.value ? 'Enviando...' : 'Enviar valoración' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </Teleport>
  </AppLayout>
</template>

<style scoped>
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
  width: min(100%, 520px);
  max-height: none;
  overflow: visible;
  border-radius: 24px;
  background: #fff;
  padding: 1.25rem;
  box-shadow: 0 24px 80px rgb(15 23 42 / 0.25);
}

.modal-header {
  margin-bottom: 1rem;
}

.modal-form {
  display: grid;
  gap: 0.75rem;
}

.rating-field {
  display: grid;
  gap: 0.5rem;
}

.rating-label {
  color: #172033;
  font-weight: 800;
}

.rating-options {
  display: grid;
  gap: 0.5rem;
}

.rating-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 3rem;
  padding: 0.65rem 1rem;
  border: 1px solid #d8e2ec;
  border-radius: 18px;
  background: #fff;
  color: #172033;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.rating-option-active {
  border-color: #0f6b85;
  background: #eaf7f8;
  color: #0f6b85;
}

.rating-icon {
  letter-spacing: 0.08em;
}

.rating-text {
  white-space: nowrap;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 3.75rem;
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

.appointment-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 1.5rem 0;
}

.appointment-filter-button {
  border: 1px solid #d8e2ec;
  border-radius: 999px;
  background: #fff;
  color: #172033;
  padding: 0.75rem 1.1rem;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.appointment-filter-button:hover {
  border-color: #0f6b85;
  color: #0f6b85;
}

.appointment-filter-button-active {
  border-color: #0f6b85;
  background: #eaf7f8;
  color: #0f6b85;
}

.empty-message {
  color: #667085;
  font-weight: 700;
}
</style>