<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  getAppointments,
  type Appointment,
} from '../modules/appointments/appointments.api'

const queryClient = useQueryClient()

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

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function canCancel(appointment: Appointment) {
  return appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED'
}

async function handleCancel(id: string) {
  const confirmed = window.confirm('¿Cancelar esta cita?')
  if (!confirmed) return

  await cancelMutation.mutateAsync(id)
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

    <div
      v-else-if="appointmentsQuery.data.value?.length"
      class="cards-grid"
    >
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

          <span class="badge">{{ appointment.status }}</span>
        </div>

        <p><strong>Dentista:</strong> {{ appointment.dentistId }}</p>
        <p v-if="appointment.notes"><strong>Notas:</strong> {{ appointment.notes }}</p>

        <div class="card-actions" v-if="canCancel(appointment)">
          <button
            class="secondary-button"
            type="button"
            :disabled="cancelMutation.isPending.value"
            @click="handleCancel(appointment.id)"
          >
            Cancelar cita
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      Todavía no tienes citas agendadas.
    </div>
  </AppLayout>
</template>
