<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  createAppointment,
  getAppointments,
  getAppointmentAvailability,
  type Appointment,
} from '../modules/appointments/appointments.api'
import {
  getDentistRatingsSummary,
  getPrioritizedDentists,
} from '../modules/dentists/dentists.service'
import type { Dentist } from '../modules/dentists/dentists.types'
const queryClient = useQueryClient()
const router = useRouter()

const search = ref('')
const filtersOpen = ref(false)
const specialtyFilter = ref('')
const showDentistDirectory = ref(false)
const selectedDentist = ref<Dentist | null>(null)
const failedPhotoDentistIds = ref(new Set<string>())
const appointmentDate = ref('')
const appointmentTime = ref('')
const reason = ref('')
const notes = ref('')
const isCreating = ref(false)
const formError = ref('')
const formSuccess = ref('')
const today = getLocalDateValue()

const DEFAULT_TIME_SLOTS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
]

const isAppointmentDatePast = computed(
  () => Boolean(appointmentDate.value) && isBeforeToday(appointmentDate.value),
)

const dentistsQuery = useQuery({
  queryKey: ['dentists', 'prioritized'],
  queryFn: getPrioritizedDentists,
})

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
})

const availabilityQuery = useQuery({
  queryKey: ['appointments', 'availability', computed(() => selectedDentist.value?.domainId), appointmentDate],
  queryFn: () => getAppointmentAvailability(selectedDentist.value!.domainId, appointmentDate.value),
  enabled: computed(
    () =>
      Boolean(selectedDentist.value?.domainId && appointmentDate.value) &&
      !isAppointmentDatePast.value,
  ),
})

const ratingsQuery = useQuery({
  queryKey: ['dentists', 'ratings', computed(() => selectedDentist.value?.domainId)],
  queryFn: () => getDentistRatingsSummary(selectedDentist.value!.domainId),
  enabled: computed(() => Boolean(selectedDentist.value?.domainId)),
})

const filteredDentists = computed(() => {
  const dentists = visibleDirectoryDentists.value
  const term = search.value.trim().toLowerCase()
  const specialty = specialtyFilter.value.trim().toLowerCase()

  return dentists.filter((dentist) => {
    const name = dentistName(dentist).toLowerCase()
    const dentistSpecialty = (dentist.specialty ?? '').toLowerCase()
    const matchesSearch =
      !term || name.includes(term) || dentistSpecialty.includes(term)
    const matchesSpecialty = !specialty || dentistSpecialty === specialty

    return matchesSearch && matchesSpecialty
  })
})

const primaryDentistAppointment = computed(() => {
  const appointments = appointmentsQuery.data.value ?? []
  const relatedAppointments = appointments
    .filter((appointment) => isPatientDentistRelation(appointment))
    .sort((a, b) => {
      return new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
    })

  return relatedAppointments[0]
})

const primaryDentist = computed(() => {
  const dentistId = primaryDentistAppointment.value?.dentistId
  if (!dentistId) return null

  return (dentistsQuery.data.value ?? []).find(
    (dentist) => dentist.domainId === dentistId,
  ) ?? null
})

const shouldShowDirectory = computed(() => {
  return !primaryDentist.value || showDentistDirectory.value
})

const visibleDirectoryDentists = computed(() => {
  const dentists = dentistsQuery.data.value ?? []
  const primaryDentistId = primaryDentist.value?.domainId

  if (!primaryDentistId) return dentists

  return dentists.filter((dentist) => dentist.domainId !== primaryDentistId)
})

const specialtyOptions = computed(() => {
  const specialties = new Set(
    (dentistsQuery.data.value ?? [])
      .map((dentist) => dentist.specialty?.trim())
      .filter((specialty): specialty is string => Boolean(specialty)),
  )

  return [...specialties].sort((a, b) => a.localeCompare(b, 'es-MX'))
})

const hasActiveFilters = computed(() => Boolean(search.value || specialtyFilter.value))

const appointmentTimeSlots = computed(() => {
  if (!appointmentDate.value || isAppointmentDatePast.value) {
    return []
  }

  const unavailableSlots = new Set(
    getAvailabilityRawSlots()
      .filter((slot) => isAvailabilitySlotAvailable(slot))
      .map((slot) => availabilitySlotTime(slot))
      .filter((slot): slot is string => Boolean(slot)),
  )

  return DEFAULT_TIME_SLOTS.filter(
    (slot) =>
      !unavailableSlots.has(slot) &&
      !isSelectedTimePast(appointmentDate.value, slot),
  )
})

const ratingAverage = computed(() => {
  const summary = ratingsQuery.data.value
  return summary?.averageScore ?? summary?.average ?? 0
})

const ratingTotal = computed(() => {
  const summary = ratingsQuery.data.value
  return summary?.totalRatings ?? summary?.ratingsCount ?? summary?.total ?? 0
})

watch(appointmentDate, (date) => {
  formError.value = ''
  appointmentTime.value = ''

  if (date && isBeforeToday(date)) {
    appointmentDate.value = today
  }
})

watch(appointmentTime, (time) => {
  if (time && !appointmentTimeSlots.value.includes(time)) {
    appointmentTime.value = ''
  }
})

watch(appointmentTimeSlots, (slots) => {
  if (appointmentTime.value && !slots.includes(appointmentTime.value)) {
    appointmentTime.value = ''
  }
})

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? 'Dentista sin nombre'
}

function dentistPhotoUrl(dentist: Dentist) {
  const url = dentist.photoUrl
  if (!url || failedPhotoDentistIds.value.has(dentist.domainId)) return ''

  if (url.startsWith('http')) return url

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${baseUrl}${url}`
}

function handleDentistPhotoError(dentist: Dentist) {
  failedPhotoDentistIds.value = new Set([
    ...failedPhotoDentistIds.value,
    dentist.domainId,
  ])
}

function openDentistDetail(dentist: Dentist) {
  router.push(`/patient/dentists/${dentist.domainId}`)
}

function isPatientDentistRelation(appointment: Appointment) {
  const status = appointment.status.toUpperCase()
  return status === 'CONFIRMED' || status === 'COMPLETED'
}

function clearFilters() {
  search.value = ''
  specialtyFilter.value = ''
}

function toggleDentistDirectory() {
  showDentistDirectory.value = !showDentistDirectory.value

  if (!showDentistDirectory.value) {
    clearFilters()
    filtersOpen.value = false
  }
}

function openSchedule(dentist: Dentist) {
  selectedDentist.value = dentist
  appointmentDate.value = ''
  appointmentTime.value = ''
  reason.value = ''
  notes.value = ''
  formError.value = ''
  formSuccess.value = ''
}

function closeSchedule() {
  selectedDentist.value = null
}

function getLocalDateValue(date = new Date()) {
  const { year, month, day } = getMexicoDateTimeParts(date)

  return `${year}-${month}-${day}`
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
  if (!date) return false
  return date < getLocalDateValue()
}

function isSelectedTimePast(date: string, time: string) {
  if (!date || !time) return false

  const today = getLocalDateValue()

  if (date > today) {
    return false
  }

  if (date < today) {
    return true
  }

  const [hours, minutes] = time.split(':').map(Number)
  const mexicoNow = getMexicoDateTimeParts()
  const currentMinutes = Number(mexicoNow.hour) * 60 + Number(mexicoNow.minute)
  const selectedMinutes = hours * 60 + minutes

  return selectedMinutes <= currentMinutes
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

function getAvailabilityRawSlots() {
  const value = availabilityQuery.data.value

  if (Array.isArray(value)) {
    return value
  }

  if (value && typeof value === 'object' && 'slots' in value) {
    const slots = (value as { slots?: unknown }).slots
    return Array.isArray(slots) ? slots : []
  }

  return []
}

function isAvailabilitySlotAvailable(slot: unknown) {
  if (typeof slot === 'string') {
    return true
  }

  const value = slot as { available?: boolean }
  return value.available !== false
}

function availabilitySlotTime(slot: unknown) {
  if (typeof slot === 'string') {
    return normalizeClosedHour(slot)
  }

  const value = slot as {
    startAt?: string
    StartAt?: string
    label?: string
  }

  return (
    normalizeClosedHour(value.startAt) ||
    normalizeClosedHour(value.StartAt) ||
    normalizeClosedHour(value.label)
  )
}

function normalizeClosedHour(value?: string) {
  if (!value) {
    return ''
  }

  const match = value.match(/\b(\d{1,2}):([0-5]\d)\b/)

  if (!match) {
    return ''
  }

  const hour = Number(match[1])
  const minutes = match[2]

  if (hour < 0 || hour > 23 || minutes !== '00') {
    return ''
  }

  return `${String(hour).padStart(2, '0')}:00`
}

function getAppointmentCreateErrorMessage(error: unknown) {
  const response =
    typeof error === 'object' && error && 'response' in error
      ? (error as { response?: { status?: number; data?: { message?: string; error?: string } } }).response
      : undefined

  const status = response?.status
  const message = response?.data?.message ?? response?.data?.error

  if (message === 'Patient already has a pending appointment request in this time range') {
    return 'Ya tienes una solicitud pendiente para ese dentista en ese horario.'
  }

  if (
    status === 409 ||
    message === 'Dentist already has an appointment in this time range'
  ) {
    return 'El dentista ya tiene una cita en ese horario. Selecciona otro horario.'
  }

  if (typeof message === 'string' && message.includes('startAt must be in the future')) {
    return 'Elige una fecha y hora posteriores al momento actual.'
  }

  if (message === 'startAt must be before endAt') {
    return 'La hora de inicio debe ser anterior a la hora de fin.'
  }

  return 'No se pudo agendar la cita. Revisa la fecha y la disponibilidad.'
}

async function submitAppointment() {
  formError.value = ''
  formSuccess.value = ''

  if (!selectedDentist.value) return

  if (!appointmentDate.value || !appointmentTime.value) {
    formError.value = 'Selecciona fecha y hora.'
    return
  }

  if (isAppointmentDatePast.value) {
    formError.value = 'Elige una fecha a partir de hoy.'
    return
  }

  if (isSelectedTimePast(appointmentDate.value, appointmentTime.value)) {
    formError.value = 'Elige una hora posterior al momento actual.'
    return
  }

  if (!appointmentTimeSlots.value.includes(appointmentTime.value)) {
    formError.value = 'Selecciona un horario disponible.'
    return
  }

  isCreating.value = true

  try {
    await createAppointment({
      dentistId: selectedDentist.value.domainId,
      startAt: localDateTimeValue(appointmentDate.value, appointmentTime.value),
      endAt: addMinutesToLocalDateTime(appointmentDate.value, appointmentTime.value, 60),
      reason: reason.value || undefined,
      notes: notes.value || undefined,
    })

    formSuccess.value = 'Cita agendada correctamente.'
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  } catch (error: any) {
    formError.value = getAppointmentCreateErrorMessage(error)
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Agenda una cita con profesionales certificados</p>
        <h2>Encuentra tu dentista</h2>
      </div>
    </div>

    <section v-if="primaryDentist" class="featured-dentist-card">
      <div class="featured-dentist-photo">
        <img
          v-if="dentistPhotoUrl(primaryDentist)"
          :src="dentistPhotoUrl(primaryDentist)"
          :alt="`Foto de ${dentistName(primaryDentist)}`"
          @error="handleDentistPhotoError(primaryDentist)"
        />
        <span v-else>{{ dentistName(primaryDentist).charAt(0).toUpperCase() }}</span>
      </div>

      <div class="featured-dentist-info">
        <p class="eyebrow">Tu dentista</p>
        <h3>{{ dentistName(primaryDentist) }}</h3>
        <span v-if="primaryDentist.previouslyVisited" class="status-badge">
          Ya te atendió
        </span>
        <p>{{ primaryDentist.specialty ?? 'Odontología general' }}</p>
        <p v-if="primaryDentist.descripcion" class="featured-dentist-description">
          {{ primaryDentist.descripcion }}
        </p>

        <div class="row-actions">
          <button class="primary-button inline-button" type="button" @click="openSchedule(primaryDentist)">
            Agendar seguimiento
          </button>
          <button class="secondary-button inline-button" type="button" @click="openDentistDetail(primaryDentist)">
            Ver perfil
          </button>
          <button class="secondary-button inline-button" type="button" @click="toggleDentistDirectory">
            {{ showDentistDirectory ? 'Ocultar cambio' : 'Cambiar dentista' }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="shouldShowDirectory" class="toolbar">
      <input
        v-model="search"
        class="search-input"
        type="search"
        :placeholder="primaryDentist ? 'Buscar otro dentista' : 'Buscar por nombre o especialidad'"
      />

      <button
        class="secondary-button inline-button filter-toggle"
        type="button"
        :aria-expanded="filtersOpen"
        aria-controls="dentist-filters"
        @click="filtersOpen = !filtersOpen"
      >
        Filtros
      </button>
    </div>

    <div v-if="shouldShowDirectory && filtersOpen" id="dentist-filters" class="filter-panel">
      <label>
        Especialidad
        <select v-model="specialtyFilter">
          <option value="">Todas las especialidades</option>
          <option
            v-for="specialty in specialtyOptions"
            :key="specialty"
            :value="specialty"
          >
            {{ specialty }}
          </option>
        </select>
      </label>

      <button
        class="secondary-button inline-button"
        type="button"
        :disabled="!hasActiveFilters"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </div>

    <p v-if="dentistsQuery.isLoading.value">Cargando dentistas...</p>

    <p v-else-if="dentistsQuery.isError.value" class="error-message">
      No se pudieron cargar los dentistas.
    </p>

    <div v-else-if="shouldShowDirectory && filteredDentists.length" class="cards-grid">
      <article
        v-for="dentist in filteredDentists"
        :key="dentist.domainId"
        class="card clickable-card"
        role="button"
        tabindex="0"
        @click="openDentistDetail(dentist)"
        @keydown.enter.prevent="openDentistDetail(dentist)"
        @keydown.space.prevent="openDentistDetail(dentist)"
      >
        <div class="card-header">
          <div class="avatar">
            <img
              v-if="dentistPhotoUrl(dentist)"
              :src="dentistPhotoUrl(dentist)"
              :alt="`Foto de ${dentistName(dentist)}`"
              @error="handleDentistPhotoError(dentist)"
            />
            <span v-else>{{ dentistName(dentist).charAt(0).toUpperCase() }}</span>
          </div>

          <div>
            <h3>{{ dentistName(dentist) }}</h3>
            <span v-if="dentist.previouslyVisited" class="status-badge">
              Ya te atendió
            </span>
            <p>{{ dentist.specialty ?? 'Odontología general' }}</p>
          </div>
        </div>

        <p style="margin-top: 14px">
          Disponible para consulta y seguimiento clínico.
        </p>

        <div class="card-actions">
          <button
            class="primary-button"
            type="button"
            @click.stop="openSchedule(dentist)"
          >
            Agendar cita
          </button>
        </div>
      </article>
    </div>

    <div v-else-if="shouldShowDirectory" class="empty-state">
      No hay dentistas disponibles con ese filtro.
    </div>

    <div v-if="selectedDentist" class="modal-backdrop" @click.self="closeSchedule">
      <section class="modal-panel appointment-modal-panel" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Nueva cita</p>
            <h2>{{ dentistName(selectedDentist) }}</h2>
            <p class="muted-text">
              {{ ratingAverage.toFixed(1) }} / 5 · {{ ratingTotal }} valoraciones
            </p>
          </div>

          <button class="secondary-button inline-button" type="button" @click="closeSchedule">
            Cerrar
          </button>
        </div>

        <form @submit.prevent="submitAppointment">
          <label>
            Fecha
            <input v-model="appointmentDate" type="date" :min="today" required />
          </label>

          <label>
            Hora
            <select
              v-model="appointmentTime"
              :disabled="!appointmentDate || availabilityQuery.isLoading.value || !appointmentTimeSlots.length"
              required
            >
              <option value="">Selecciona un horario</option>
              <option
                v-for="slot in appointmentTimeSlots"
                :key="slot"
                :value="slot"
              >
                {{ slot }}
              </option>
            </select>
          </label>

          <p v-if="availabilityQuery.isLoading.value" class="muted-text">
            Consultando horarios disponibles...
          </p>
          <p
            v-else-if="appointmentDate && !isAppointmentDatePast && !appointmentTimeSlots.length && !availabilityQuery.isError.value"
            class="muted-text"
          >
            No hay horarios disponibles para esta fecha.
          </p>

          <label>
            Motivo
            <input v-model="reason" type="text" placeholder="Consulta general" />
          </label>

          <label>
            Notas
            <textarea v-model="notes" rows="3" placeholder="Notas opcionales" />
          </label>

          <p v-if="availabilityQuery.isError.value" class="error-message">
            No se pudo consultar disponibilidad. Cambia la fecha o vuelve a intentar.
          </p>
          <p v-if="formError" class="error-message">{{ formError }}</p>
          <p v-if="formSuccess" class="success-message">{{ formSuccess }}</p>

          <button
            class="primary-button"
            type="submit"
            :disabled="isCreating || !appointmentTimeSlots.length"
          >
            {{ isCreating ? 'Agendando...' : 'Confirmar cita' }}
          </button>
        </form>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin: 6px 0 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #e6f7f2;
  color: #0f766e;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
}
</style>