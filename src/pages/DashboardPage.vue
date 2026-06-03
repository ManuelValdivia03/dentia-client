<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'
import { getAppointments } from '../modules/appointments/appointments.api'

const authStore = useAuthStore()

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
})
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Resumen</p>
        <h2>Dashboard</h2>
      </div>
    </div>

    <div class="cards-grid">
      <article class="card metric-card">
        <p>Rol actual</p>
        <h3>{{ authStore.user?.role }}</h3>
      </article>

      <article class="card metric-card">
        <p>Citas visibles</p>
        <h3>{{ appointmentsQuery.data.value?.length ?? 0 }}</h3>
      </article>
    </div>
  </AppLayout>
</template>
