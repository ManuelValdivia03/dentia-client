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

const ratingsSummary = computed(() => ratingsQuery.data.value)

const ratingAverage = computed(() => {
  return Number(ratingsSummary.value?.averageScore ?? 0)
})

const ratingTotal = computed(() => {
  return Number(ratingsSummary.value?.totalRatings ?? 0)
})

const latestRatings = computed(() => {
  return ratingsSummary.value?.latestRatings ?? []
})

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? 'Dentista sin nombre'
}

function formatRating(value: number) {
  return Number(value || 0).toFixed(1)
}

function formatRatingDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
  }).format(new Date(value))
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

        <div v-else-if="dentist" class="profile-detail-content">
          <div class="profile-grid">
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
                {{ formatRating(ratingAverage) }} / 5 · {{ ratingTotal }}
                {{ ratingTotal === 1 ? 'valoración' : 'valoraciones' }}
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

          <section class="card dentist-ratings-preview">
            <div class="compact-header">
              <div>
                <p class="eyebrow">Opiniones</p>
                <h3>Últimos comentarios</h3>
              </div>
            </div>

            <p v-if="ratingsQuery.isLoading.value" class="muted-text">
              Cargando valoraciones...
            </p>

            <p v-else-if="ratingsQuery.isError.value" class="error-message">
              No se pudieron cargar las valoraciones.
            </p>

            <div v-else-if="latestRatings.length" class="dentist-rating-list">
              <article
                v-for="rating in latestRatings"
                :key="rating.id"
                class="dentist-rating-item"
              >
                <div class="dentist-rating-header">
                  <strong>{{ rating.score }} / 5</strong>
                  <span>Paciente</span>
                </div>

                <p>{{ rating.comment || 'Sin comentario.' }}</p>

                <small>{{ formatRatingDate(rating.createdAt) }}</small>
              </article>
            </div>

            <p v-else class="muted-text">
              Este dentista aún no tiene comentarios.
            </p>
          </section>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.profile-detail-content {
  display: grid;
  gap: 1.5rem;
}

.dentist-ratings-preview {
  display: grid;
  gap: 1rem;
}

.dentist-rating-list {
  display: grid;
  gap: 0.85rem;
}

.dentist-rating-item {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem;
  background: #fbfdff;
}

.dentist-rating-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.dentist-rating-header strong {
  color: var(--primary);
  font-weight: 900;
}

.dentist-rating-header span {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 800;
}

.dentist-rating-item p {
  margin: 0.5rem 0;
  color: var(--text);
  line-height: 1.5;
}

.dentist-rating-item small {
  color: var(--muted);
  font-weight: 700;
}
</style>