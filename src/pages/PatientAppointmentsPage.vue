<script setup lang="ts">
import { ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  getAppointments,
  rateAppointment,
  rescheduleAppointment,
  type Appointment,
} from '../modules/appointments/appointments.api'

const queryClient = useQueryClient()

const rescheduleTarget = ref<Appointment | null>(null)
const rescheduleDate = ref('')
const rescheduleTime = ref('')
const ratingTarget = ref<Appointment | null>(null)
const ratingScore = ref(5)
const ratingComment = ref('')
const today = new Date().toISOString().slice(0, 10)
const rescheduleError = ref('')

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
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

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
  rescheduleDate.value = date.toISOString().slice(0, 10)
  rescheduleTime.value = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

async function submitReschedule() {
  rescheduleError.value = ''

  if (!rescheduleTarget.value || !rescheduleDate.value || !rescheduleTime.value) {
    return
  }

  if (rescheduleDate.value < today) {
    rescheduleError.value = 'No puedes reprogramar citas en fechas pasadas.'
    return
  }

  const start = new Date(`${rescheduleDate.value}T${rescheduleTime.value}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    rescheduleError.value = 'Selecciona una fecha y hora futuras.'
    return
  }

  await rescheduleMutation.mutateAsync({
    id: rescheduleTarget.value.id,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  })
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

    <div v-else-if="appointmentsQuery.data.value?.length" class="cards-grid">
      <article
        v-for="appointment in appointmentsQuery.data.value"
        :key="appointment.id"
        class="card"
      >
        <div class="card-header">
          <div>
            <h3>{{ appointment.reason ?? 'Cita odontológica' }}</h3>
            <p>{{ formatDate(appointment.startAt) }}</p>
          </div>

          <span class="badge">{{ statusLabel(appointment.status) }}</span>
        </div>

        <p><strong>Dentista:</strong> {{ appointment.dentistId }}</p>
        <p v-if="appointment.notes"><strong>Notas:</strong> {{ appointment.notes }}</p>

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
      </article>
    </div>

    <div v-else class="empty-state">
      Todavía no tienes citas agendadas.
    </div>

    <div v-if="rescheduleTarget" class="card section-card">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Reprogramar</p>
          <h2>{{ rescheduleTarget.reason ?? 'Cita odontológica' }}</h2>
        </div>
        <button class="secondary-button inline-button" type="button" @click="rescheduleTarget = null">
          Cerrar
        </button>
      </div>

      <form @submit.prevent="submitReschedule">
        <label>
          Fecha
          <input v-model="rescheduleDate" type="date" :min="today" required />
        </label>
        <label>
          Hora
          <input v-model="rescheduleTime" type="time" required />
        </label>
        <button class="primary-button" type="submit" :disabled="rescheduleMutation.isPending.value">
          Guardar cambio
        </button>
        <p v-if="rescheduleError" class="error-message">{{ rescheduleError }}</p>
      </form>
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
