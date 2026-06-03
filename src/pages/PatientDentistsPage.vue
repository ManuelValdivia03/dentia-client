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
  getDentists,
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
const isAppointmentDatePast = computed(
  () => Boolean(appointmentDate.value) && isBeforeToday(appointmentDate.value),
)
const appointmentMinTime = computed(
  () => (appointmentDate.value === today ? getLocalTimeValue() : undefined),
)

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: getDentists,
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

const availabilitySlots = computed(() => {
  const value = availabilityQuery.data.value
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
  if (time && isSelectedTimePast(appointmentDate.value, time)) {
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

  const value = slot as { startAt?: string; endAt?: string; label?: string }

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
    if (!appointmentDate.value) return false
    return new Date(`${appointmentDate.value}T${slot}:00`).getTime() <= now
  }

  const value = slot as { startAt?: string; available?: boolean }
  if (value.available === false) return true
  if (!value.startAt) return false

  return new Date(value.startAt).getTime() <= now
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

  const start = new Date(`${appointmentDate.value}T${appointmentTime.value}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  if (isSelectedTimePast(appointmentDate.value, appointmentTime.value)) {
    formError.value = 'Elige una hora posterior al momento actual.'
    return
  }

  isCreating.value = true

  try {
    await createAppointment({
      dentistId: selectedDentist.value.domainId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: reason.value || undefined,
      notes: notes.value || undefined,
    })

    formSuccess.value = 'Cita agendada correctamente.'
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  } catch (error: any) {
    const message = error.response?.data?.message ?? error.response?.data?.error
    formError.value =
      typeof message === 'string' && message.includes('startAt must be in the future')
        ? 'Elige una fecha y hora posteriores al momento actual.'
        : 'No se pudo agendar la cita. Revisa la fecha y la disponibilidad.'
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

    <div v-if="selectedDentist" class="card section-card">
      <div class="page-header compact-header">
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

        <label v-if="availabilitySlots.length">
          Hora
          <select v-model="appointmentTime" :disabled="!appointmentDate">
            <option value="">Selecciona un horario</option>
            <option
              v-for="slot in availabilitySlots"
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
            v-model="appointmentTime"
            type="time"
            :disabled="!appointmentDate"
            :min="appointmentMinTime"
            required
          />
        </label>

        <label>
          Motivo
          <input v-model="reason" type="text" placeholder="Consulta general" />
        </label>

        <label>
          Notas
          <textarea v-model="notes" rows="3" placeholder="Notas opcionales" />
        </label>

        <p v-if="availabilityQuery.isError.value" class="error-message">
          No se pudo consultar disponibilidad; puedes elegir fecha y volver a intentar.
        </p>
        <p v-if="formError" class="error-message">{{ formError }}</p>
        <p v-if="formSuccess" class="success-message">{{ formSuccess }}</p>

        <button class="primary-button" type="submit" :disabled="isCreating">
          {{ isCreating ? 'Agendando...' : 'Confirmar cita' }}
        </button>
      </form>
    </div>
  </AppLayout>
</template>
