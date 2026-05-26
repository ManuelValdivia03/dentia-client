<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { createAppointment } from '../modules/appointments/appointments.api'
import axios from 'axios'

interface Dentist {
  id?: string
  domainId: string
  fullName?: string
  name?: string
  email?: string
  specialty?: string
}

interface StoredUser {
  domainId?: string
  role?: string
  email?: string
  fullName?: string
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dentia_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

async function fetchDentists() {
  const { data } = await api.get<Dentist[]>('/dentists')
  return data
}

function getCurrentUser(): StoredUser | null {
  const raw = localStorage.getItem('dentia_user')
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

const search = ref('')
const selectedDentist = ref<Dentist | null>(null)
const appointmentDate = ref('')
const appointmentTime = ref('')
const reason = ref('')
const notes = ref('')
const isCreating = ref(false)
const formError = ref('')
const formSuccess = ref('')

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: fetchDentists,
})

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? 'Dentista sin nombre'
}

const filteredDentists = computed(() => {
  const dentists = dentistsQuery.data.value ?? []
  const term = search.value.trim().toLowerCase()

  if (!term) return dentists

  return dentists.filter((dentist) => {
    const name = dentistName(dentist).toLowerCase()
    const specialty = (dentist.specialty ?? '').toLowerCase()
    return name.includes(term) || specialty.includes(term)
  })
})

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

async function submitAppointment() {
  formError.value = ''
  formSuccess.value = ''

  if (!selectedDentist.value) return

  if (!appointmentDate.value || !appointmentTime.value) {
    formError.value = 'Selecciona fecha y hora.'
    return
  }

  const currentUser = getCurrentUser()
  const patientId = currentUser?.domainId

  if (!patientId) {
    formError.value = 'No se encontró el identificador del paciente.'
    return
  }

  const start = new Date(`${appointmentDate.value}T${appointmentTime.value}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  isCreating.value = true

  try {
    await createAppointment({
      patientId,
      dentistId: selectedDentist.value.domainId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: reason.value || undefined,
      notes: notes.value || undefined,
    })

    formSuccess.value = 'Cita agendada correctamente.'
  } catch (error: any) {
    console.error('Create appointment error:', error.response?.data ?? error)
    const message = error.response?.data?.message ?? error.response?.data?.error
    formError.value = typeof message === 'string' ? message : 'No se pudo agendar la cita.'
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

    <div class="toolbar">
      <input
        v-model="search"
        class="search-input"
        type="search"
        placeholder="Buscar por nombre o especialidad"
      />
    </div>

    <p v-if="dentistsQuery.isLoading.value">Cargando dentistas...</p>

    <p v-else-if="dentistsQuery.isError.value" class="error-message">
      No se pudieron cargar los dentistas.
    </p>

    <div v-else-if="filteredDentists.length" class="cards-grid">
      <article
        v-for="dentist in filteredDentists"
        :key="dentist.domainId"
        class="card"
      >
        <div class="card-header">
          <div class="avatar">
            {{ dentistName(dentist).charAt(0).toUpperCase() }}
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
          <button class="primary-button" type="button" @click="openSchedule(dentist)">
            Agendar cita
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      No hay dentistas disponibles con ese filtro.
    </div>

    <div v-if="selectedDentist" class="card" style="margin-top: 24px">
      <div class="page-header">
        <div>
          <p class="eyebrow">Nueva cita</p>
          <h2>{{ dentistName(selectedDentist) }}</h2>
        </div>

        <button class="secondary-button" type="button" @click="closeSchedule">
          Cerrar
        </button>
      </div>

      <form @submit.prevent="submitAppointment">
        <label>
          Fecha
          <input v-model="appointmentDate" type="date" required />
        </label>

        <label>
          Hora
          <input v-model="appointmentTime" type="time" required />
        </label>

        <label>
          Motivo
          <input v-model="reason" type="text" placeholder="Consulta general" />
        </label>

        <label>
          Notas
          <textarea v-model="notes" rows="3" placeholder="Notas opcionales" />
        </label>

        <p v-if="formError" class="error-message">{{ formError }}</p>
        <p v-if="formSuccess" class="success-message">{{ formSuccess }}</p>

        <button class="primary-button" type="submit" :disabled="isCreating">
          {{ isCreating ? 'Agendando...' : 'Confirmar cita' }}
        </button>
      </form>
    </div>
  </AppLayout>
</template>
