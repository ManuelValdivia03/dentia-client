<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { getDentists } from '../modules/dentists/dentists.service'

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: getDentists,
})

function getDentistName(dentist: any) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? 'Dentista sin nombre'
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Dentistas afiliados</p>
        <h2>Encuentra tu dentista</h2>
      </div>
    </div>

    <p v-if="dentistsQuery.isLoading.value">Cargando dentistas...</p>

    <p v-else-if="dentistsQuery.isError.value" class="error-message">
      No se pudieron cargar los dentistas.
    </p>

    <div v-else class="cards-grid">
      <article
        v-for="dentist in dentistsQuery.data.value"
        :key="dentist.domainId"
        class="card"
      >
        <div class="avatar">
          {{ getDentistName(dentist).charAt(0).toUpperCase() }}
        </div>

        <h3>{{ getDentistName(dentist) }}</h3>
        <p>{{ dentist.specialty ?? 'Odontología general' }}</p>

        <button>
          Ver disponibilidad
        </button>
      </article>
    </div>
  </AppLayout>
</template>