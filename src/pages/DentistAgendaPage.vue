<script setup lang="ts">
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointments,
  type Appointment,
} from '../modules/appointments/appointments.api'

const queryClient = useQueryClient()

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

const appointments = computed(() => {
  return [...(appointmentsQuery.data.value ?? [])].sort((a, b) => {
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
})

function normalizeStatus(status: string) {
  return status.toUpperCase()
}

function statusLabel(status: string) {
  const normalized = normalizeStatus(status)

  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    COMPLETED: 'Completada',
  }

  return labels[normalized] ?? status
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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

    <div v-else-if="appointments.length" class="cards-grid">
      <article
        v-for="appointment in appointments"
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

        <p><strong>Paciente:</strong> {{ appointment.patientId }}</p>
        <p v-if="appointment.notes">
          <strong>Notas:</strong> {{ appointment.notes }}
        </p>

        <div class="card-actions">
          <button
            v-if="canConfirm(appointment)"
            class="primary-button"
            type="button"
            :disabled="isBusy()"
            @click="handleConfirm(appointment.id)"
          >
            Confirmar
          </button>

          <button
            v-if="canComplete(appointment)"
            class="primary-button"
            type="button"
            :disabled="isBusy()"
            @click="handleComplete(appointment.id)"
          >
            Completar
          </button>

          <button
            v-if="canCancel(appointment)"
            class="secondary-button"
            type="button"
            :disabled="isBusy()"
            @click="handleCancel(appointment.id)"
          >
            Cancelar
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      No tienes citas asignadas.
    </div>
  </AppLayout>
</template>
