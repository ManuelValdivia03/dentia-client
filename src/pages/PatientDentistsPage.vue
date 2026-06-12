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
import {
  addMinutesToLocalDateTime,
  datePartFromDateTime,
  getClinicNowKey,
  isFutureClinicDateTime,
  localDateTimeValue,
  timePartFromDateTime,
} from '../utils/clinic-time'
import { getApiErrorMessage } from '../utils/api-error'

const queryClient = useQueryClient()
const router = useRouter()

const search = ref('')
const filtersOpen = ref(false)
const specialtyFilter = ref('')
const selectedDentist = ref<Dentist | null>(null)
const failedPhotoDentistIds = ref(new Set<string>())
const appointmentDate = ref('')
const appointmentTime = ref('')
const reason = ref('')
const notes = ref('')
const isCreating = ref(false)
const formError = ref('')
const formSuccess = ref('')
const pageSuccess = ref('')
const pageError = ref('')
const today = computed(() => getClinicNowKey().slice(0, 10))
const relevantAppointmentStatuses = [
  'PENDING',
  'REQUESTED',
  'CONFIRMED',
  'SCHEDULED',
  'COMPLETED',
  'ATTENDED',
]

const isAppointmentDatePast = computed(
  () => Boolean(appointmentDate.value) && appointmentDate.value < today.value,
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

const dentistsErrorMessage = computed(() => {
  if (!dentistsQuery.error.value) return ''
  return getApiErrorMessage(dentistsQuery.error.value)
})

const availabilityErrorMessage = computed(() => {
  if (!availabilityQuery.error.value) return ''
  return getApiErrorMessage(availabilityQuery.error.value)
})

const appointmentsErrorMessage = computed(() => {
  if (!appointmentsQuery.error.value) return ''
  return getApiErrorMessage(appointmentsQuery.error.value)
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

const highlightedDentistAppointment = computed(() => {
  const appointments = appointmentsQuery.data.value ?? []

  return appointments
    .filter((appointment) =>
      relevantAppointmentStatuses.includes(appointment.status.toUpperCase()),
    )
    .sort((a, b) => appointmentTimestamp(b) - appointmentTimestamp(a))[0] ?? null
})

const highlightedDentist = computed(() => {
  const dentistId = highlightedDentistAppointment.value?.dentistId
  if (!dentistId) return null

  return (dentistsQuery.data.value ?? []).find(
    (dentist) => dentist.domainId === dentistId,
  ) ?? null
})

const visibleDirectoryDentists = computed(() => {
  return dentistsQuery.data.value ?? []
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

const availabilitySlots = computed(() => {
  const value = availabilityQuery.data.value

  const rawSlots = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'slots' in value
      ? (value as { slots?: unknown[] }).slots ?? []
      : []

  return rawSlots.filter((slot) => isSelectableSlot(slot))
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

  if (date && date < today.value) {
    appointmentDate.value = today.value
  }
})

watch(appointmentTime, (time) => {
  if (time && isSelectedTimePast(appointmentDate.value, time)) {
    appointmentTime.value = ''
  }
})

type AppointmentWithAuditDates = Appointment & {
  createdAt?: string
  updatedAt?: string
}

function appointmentTimestamp(appointment: Appointment) {
  const item = appointment as AppointmentWithAuditDates

  return new Date(
    item.updatedAt ??
    item.createdAt ??
    item.startAt ??
    0,
  ).getTime()
}

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

function clearFilters() {
  search.value = ''
  specialtyFilter.value = ''
}

function dentistStatus(dentist: Dentist) {
  const appointments = (appointmentsQuery.data.value ?? [])
    .filter((appointment) => appointment.dentistId === dentist.domainId)
    .sort((a, b) => appointmentTimestamp(b) - appointmentTimestamp(a))

  const latestAppointment = appointments.find((appointment) =>
    relevantAppointmentStatuses.includes(appointment.status.toUpperCase()),
  )

  if (!latestAppointment) return ''

  const status = latestAppointment.status.toUpperCase()

  if (status === 'PENDING' || status === 'REQUESTED') {
    return 'Solicitud enviada'
  }

  if (status === 'CONFIRMED' || status === 'SCHEDULED') {
    return 'Cita confirmada'
  }

  if (status === 'COMPLETED' || status === 'ATTENDED') {
    return 'Ya te atendió'
  }

  return ''
}

function openSchedule(dentist: Dentist) {
  selectedDentist.value = dentist
  appointmentDate.value = ''
  appointmentTime.value = ''
  reason.value = ''
  notes.value = ''
  formError.value = ''
  formSuccess.value = ''
  pageSuccess.value = ''
  pageError.value = ''
}

function closeSchedule() {
  selectedDentist.value = null
}

function isSelectedTimePast(date: string, time: string) {
  if (!date || !time) return false

  return !isFutureClinicDateTime(date, time)
}

function slotLabel(slot: unknown) {
  if (typeof slot === 'string') return slot

  const value = slot as { startAt?: string; endAt?: string; label?: string }

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

function isSelectableSlot(slot: unknown) {
  if (typeof slot === 'string') {
    if (!appointmentDate.value) return false

    return isFutureClinicDateTime(appointmentDate.value, slot)
  }

  const value = slot as {
    startAt?: string
    available?: boolean
    Available?: boolean
  }

  const available = value.available ?? value.Available ?? true

  if (available === false) return false
  if (!value.startAt) return false

  return isFutureClinicDateTime(
    datePartFromDateTime(value.startAt),
    timePartFromDateTime(value.startAt),
  )
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

  if (!isFutureClinicDateTime(appointmentDate.value, appointmentTime.value)) {
    formError.value = 'Elige una fecha y hora posteriores al momento actual.'
    return
  }

  isCreating.value = true

  try {
    const createdAppointment = await createAppointment({
      dentistId: selectedDentist.value.domainId,
      startAt: localDateTimeValue(appointmentDate.value, appointmentTime.value),
      endAt: addMinutesToLocalDateTime(appointmentDate.value, appointmentTime.value, 60),
      reason: reason.value || undefined,
      notes: notes.value || undefined,
    })

    queryClient.setQueryData<Appointment[]>(['appointments'], (current) => {
      return [createdAppointment, ...(current ?? [])]
    })

    pageSuccess.value = 'Solicitud de cita enviada correctamente.'
    await queryClient.invalidateQueries({ queryKey: ['appointments'] })
    closeSchedule()
  } catch (error: unknown) {
    formError.value = getApiErrorMessage(error)
  } finally {
    isCreating.value = false
  }
}

function hasDentistPhotoFailed(dentist: Dentist) {
  return failedPhotoDentistIds.value.has(dentist.domainId)
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

    <p v-if="pageSuccess" class="success-message">
      {{ pageSuccess }}
    </p>

    <p v-if="pageError" class="error-message">
      {{ pageError }}
    </p>

    <section v-if="highlightedDentist" class="featured-dentist-card">
      <div class="featured-dentist-photo">
        <img
          v-if="dentistPhotoUrl(highlightedDentist)"
          :src="dentistPhotoUrl(highlightedDentist)"
          :alt="`Foto de ${dentistName(highlightedDentist)}`"
          @error="handleDentistPhotoError(highlightedDentist)"
        />
        <span v-else>
          {{ dentistName(highlightedDentist).charAt(0).toUpperCase() }}
        </span>
      </div>

      <p v-if="hasDentistPhotoFailed(highlightedDentist)" class="muted-text">
        Foto no disponible
      </p>

      <div class="featured-dentist-info">
        <p class="eyebrow">Seguimiento actual</p>
        <h3>{{ dentistName(highlightedDentist) }}</h3>

        <span
          v-if="dentistStatus(highlightedDentist)"
          class="status-badge"
        >
          {{ dentistStatus(highlightedDentist) }}
        </span>

        <p>{{ highlightedDentist.specialty ?? 'Odontología general' }}</p>

        <p
          v-if="highlightedDentist.descripcion"
          class="featured-dentist-description"
        >
          {{ highlightedDentist.descripcion }}
        </p>

        <div class="row-actions">
          <button
            class="primary-button inline-button"
            type="button"
            @click="openSchedule(highlightedDentist)"
          >
            Agendar seguimiento
          </button>

          <button
            class="secondary-button inline-button"
            type="button"
            @click="openDentistDetail(highlightedDentist)"
          >
            Ver perfil
          </button>
        </div>
      </div>
    </section>

    <div class="toolbar">
      <input
        v-model="search"
        class="search-input"
        type="search"
        placeholder="Buscar por nombre o especialidad"
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

    <div v-if="filtersOpen" id="dentist-filters" class="filter-panel">
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
      {{ dentistsErrorMessage }}
    </p>

    <div v-else-if="filteredDentists.length" class="cards-grid">
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
            <span v-else>
              {{ dentistName(dentist).charAt(0).toUpperCase() }}
            </span>
          </div>

          <div>
            <h3>{{ dentistName(dentist) }}</h3>

            <p v-if="hasDentistPhotoFailed(dentist)" class="muted-text">
              Foto no disponible
            </p>

            <span
              v-if="dentistStatus(dentist)"
              class="status-badge"
            >
              {{ dentistStatus(dentist) }}
            </span>

            <p>{{ dentist.specialty ?? 'Odontología general' }}</p>
          </div>
        </div>

        <p class="dentist-card-description">
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

    <p v-if="appointmentsQuery.isError.value" class="error-message">
      {{ appointmentsErrorMessage }}
    </p>

    <div
      v-if="
        !dentistsQuery.isLoading.value &&
        !dentistsQuery.isError.value &&
        !filteredDentists.length
      "
      class="empty-state"
    >
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

          <button
            class="secondary-button inline-button"
            type="button"
            @click="closeSchedule"
          >
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
              :disabled="
                !appointmentDate ||
                availabilityQuery.isLoading.value ||
                !availabilitySlots.length
              "
              required
            >
              <option value="">Selecciona un horario</option>
              <option
                v-for="slot in availabilitySlots"
                :key="`${slotTime(slot)}-${slotLabel(slot)}`"
                :value="slotTime(slot)"
              >
                {{ slotLabel(slot) }}
              </option>
            </select>
          </label>

          <p
            v-if="appointmentDate && availabilityQuery.isLoading.value"
            class="muted-text"
          >
            Cargando horarios disponibles...
          </p>

          <p
            v-else-if="
              appointmentDate &&
              !availabilityQuery.isError.value &&
              !availabilitySlots.length
            "
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
            {{ availabilityErrorMessage }}
          </p>

          <p v-if="formError" class="error-message">
            {{ formError }}
          </p>

          <p v-if="formSuccess" class="success-message">
            {{ formSuccess }}
          </p>

          <button class="primary-button" type="submit" :disabled="isCreating">
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

.dentist-card-description {
  margin-top: 14px;
  min-height: 56px;
  line-height: 1.55;
  color: #64748b;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.cards-grid .card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cards-grid .card-header {
  margin-bottom: 12px;
}

.cards-grid .card .card-actions {
  margin-top: auto;
  padding-top: 16px;
}

.cards-grid .card p {
  line-height: 1.55;
}

.featured-dentist-card {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 28px;
  align-items: center;
  padding: 28px 32px;
  min-height: auto;
}

.featured-dentist-photo,
.featured-dentist-photo img,
.featured-dentist-photo span {
  width: 150px;
  height: 150px;
}

.featured-dentist-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.featured-dentist-photo span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  background: #0f6b84;
  color: #ffffff;
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #0f6b84;
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1;
}

.featured-dentist-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.featured-dentist-info h3 {
  margin: 0;
}

.featured-dentist-description {
  margin: 2px 0 8px;
  line-height: 1.5;
  color: #64748b;
}

.featured-dentist-info .row-actions {
  margin-top: 14px;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
</style>