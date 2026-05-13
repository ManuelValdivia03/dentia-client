<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { getDentists } from '../modules/dentists/dentists.service'

const search = ref('')

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: getDentists,
})

function getDentistName(dentist: any) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? 'Dentista sin nombre'
}

const filteredDentists = computed(() => {
  const dentists = dentistsQuery.data.value ?? []
  const term = search.value.trim().toLowerCase()

  if (!term) return dentists

  return dentists.filter((dentist: any) =>
    getDentistName(dentist).toLowerCase().includes(term),
  )
})
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
      <button class="secondary-button">Filtros</button>
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
            {{ getDentistName(dentist).charAt(0).toUpperCase() }}
          </div>

          <div>
            <h3>{{ getDentistName(dentist) }}</h3>
            <p>{{ dentist.specialty ?? 'Odontología general' }}</p>
          </div>
        </div>

        <p style="margin-top: 14px;">
          Disponible para consulta y seguimiento clínico.
        </p>

        <div class="card-actions">
          <button class="primary-button">
            Agendar cita
          </button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      No hay dentistas disponibles con ese filtro.
    </div>
  </AppLayout>
</template>