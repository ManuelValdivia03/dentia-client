<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  getDentistByDomainId,
  getDentistRatingsSummary,
} from '../modules/dentists/dentists.service'
import type { Dentist } from '../modules/dentists/dentists.types'

const route = useRoute()
const router = useRouter()
const photoFailed = ref(false)

const dentistId = computed(() => String(route.params.domainId ?? ''))

const dentistQuery = useQuery({
  queryKey: ['dentists', dentistId],
  queryFn: () => getDentistByDomainId(dentistId.value),
  enabled: computed(() => Boolean(dentistId.value)),
})

const ratingsQuery = useQuery({
  queryKey: ['dentists', 'ratings', dentistId],
  queryFn: () => getDentistRatingsSummary(dentistId.value),
  enabled: computed(() => Boolean(dentistId.value)),
})

const dentist = computed(() => dentistQuery.data.value)

const displayName = computed(() =>
  dentist.value ? dentistName(dentist.value) : 'Dentista',
)

const initials = computed(() =>
  displayName.value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(''),
)

const photoUrl = computed(() => {
  if (!dentist.value || photoFailed.value) return ''

  return dentistPhotoUrl(dentist.value)
})

const ratingAverage = computed(() => {
  const summary = ratingsQuery.data.value
  return summary?.averageScore ?? summary?.average ?? 0
})

const ratingTotal = computed(() => {
  const summary = ratingsQuery.data.value
  return summary?.totalRatings ?? summary?.ratingsCount ?? summary?.total ?? 0
})

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? 'Dentista sin nombre'
}

function dentistPhotoUrl(dentist: Dentist) {
  const url = dentist.photoUrl
  if (!url) return ''

  if (url.startsWith('http')) return url

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${baseUrl}${url}`
}

function goBack() {
  router.push('/patient/dentists')
}
</script>

<template>
  <AppLayout>
    <div class="modal-backdrop" @click.self="goBack">
      <section class="modal-panel profile-modal-panel" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Perfil del dentista</p>
            <h2>{{ displayName }}</h2>
          </div>

          <button class="secondary-button inline-button" type="button" @click="goBack">
            Cerrar
          </button>
        </div>

        <p v-if="dentistQuery.isLoading.value">Cargando dentista...</p>

        <p v-else-if="dentistQuery.isError.value" class="error-message">
          No se pudo cargar la información del dentista.
        </p>

        <div v-else-if="dentist" class="profile-grid">
          <aside class="card profile-summary">
            <div class="profile-photo-preview">
              <img
                v-if="photoUrl"
                :src="photoUrl"
                :alt="`Foto de ${displayName}`"
                @error="photoFailed = true"
              />
              <span v-else>{{ initials }}</span>
            </div>

            <h3>{{ displayName }}</h3>
            <p>{{ dentist.specialty ?? 'Odontología general' }}</p>
            <span class="status-pill">
              {{ ratingAverage.toFixed(1) }} / 5 · {{ ratingTotal }} valoraciones
            </span>
          </aside>

          <section class="card">
            <div class="details-list">
              <div>
                <span>Correo</span>
                <strong>{{ dentist.email ?? 'No registrado' }}</strong>
              </div>

              <div>
                <span>Especialidad</span>
                <strong>{{ dentist.specialty ?? 'Odontología general' }}</strong>
              </div>

              <div>
                <span>Cédula profesional</span>
                <strong>{{ dentist.cedulaProfesional ?? 'No registrada' }}</strong>
              </div>

              <div>
                <span>Escuela</span>
                <strong>{{ dentist.escuela ?? 'No registrada' }}</strong>
              </div>

              <div class="details-list-wide">
                <span>Descripción</span>
                <strong>{{ dentist.descripcion ?? 'Sin descripción registrada.' }}</strong>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  </AppLayout>
</template>
