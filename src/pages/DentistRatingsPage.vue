<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'
import { getDentistRatingsSummary } from '../modules/appointments/appointments.api'

const authStore = useAuthStore()

const dentistId = computed(() => authStore.user?.domainId ?? '')

const ratingsQuery = useQuery({
  queryKey: ['dentist-ratings', dentistId],
  queryFn: () => getDentistRatingsSummary(dentistId.value),
  enabled: computed(() => Boolean(dentistId.value)),
})

const summary = computed(() => ratingsQuery.data.value)

const averageScore = computed(() =>
  Number(summary.value?.averageScore ?? 0).toFixed(1),
)

const totalRatings = computed(() => summary.value?.totalRatings ?? 0)

const latestRatings = computed(() => summary.value?.latestRatings ?? [])

const ratingDistribution = computed(() => {
  const counts = new Map<number, number>()

  for (const rating of latestRatings.value) {
    counts.set(rating.score, (counts.get(rating.score) ?? 0) + 1)
  }

  return [5, 4, 3, 2, 1].map((score) => {
    const total = counts.get(score) ?? 0
    const percentage =
      latestRatings.value.length > 0
        ? Math.round((total / latestRatings.value.length) * 100)
        : 0

    return {
      score,
      total,
      percentage,
    }
  })
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Valoraciones</p>
        <h2>Opiniones de pacientes</h2>
      </div>
    </div>

    <p v-if="ratingsQuery.isLoading.value" class="empty-state">
      Cargando valoraciones...
    </p>

    <p v-else-if="ratingsQuery.isError.value" class="error-message">
      No se pudieron cargar las valoraciones.
    </p>

    <div v-else class="ratings-layout">
      <section class="card rating-summary-card">
        <p class="eyebrow">Promedio general</p>

        <div class="rating-score">
          {{ averageScore }}
          <span>/ 5</span>
        </div>

        <p>
          {{ totalRatings }}
          {{ totalRatings === 1 ? 'valoración recibida' : 'valoraciones recibidas' }}
        </p>
      </section>

      <section class="card">
        <div class="compact-header">
          <p class="eyebrow">Distribución</p>
          <h3>Calificaciones recientes</h3>
        </div>

        <div class="rating-bars">
          <div
            v-for="item in ratingDistribution"
            :key="item.score"
            class="rating-bar-row"
          >
            <span>{{ item.score }} ★</span>

            <div class="rating-bar-track">
              <div
                class="rating-bar-fill"
                :style="{ width: `${item.percentage}%` }"
              />
            </div>

            <strong>{{ item.total }}</strong>
          </div>
        </div>
      </section>

      <section class="card ratings-list-card">
        <div class="compact-header">
          <p class="eyebrow">Comentarios</p>
          <h3>Últimas valoraciones</h3>
        </div>

        <div v-if="latestRatings.length" class="nested-list">
          <article
            v-for="rating in latestRatings"
            :key="rating.id"
            class="rating-list-item"
          >
            <div>
              <strong>{{ rating.score }} / 5</strong>
              <p>{{ rating.comment || 'Sin comentario.' }}</p>
              <span>{{ formatDate(rating.createdAt) }}</span>
            </div>
          </article>
        </div>

        <p v-else class="empty-state">
          Aún no tienes valoraciones.
        </p>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.ratings-layout {
  display: grid;
  grid-template-columns: minmax(220px, 320px) 1fr;
  gap: 18px;
  align-items: start;
}

.rating-summary-card {
  display: grid;
  gap: 0.75rem;
}

.rating-score {
  color: var(--primary);
  font-size: 4rem;
  font-weight: 900;
  line-height: 1;
}

.rating-score span {
  color: var(--muted);
  font-size: 1.25rem;
}

.rating-bars {
  display: grid;
  gap: 0.75rem;
}

.rating-bar-row {
  display: grid;
  grid-template-columns: 48px 1fr 32px;
  gap: 0.75rem;
  align-items: center;
}

.rating-bar-row span,
.rating-bar-row strong {
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 900;
}

.rating-bar-track {
  height: 0.75rem;
  overflow: hidden;
  border-radius: 999px;
  background: #eef6fa;
}

.rating-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
}

.ratings-list-card {
  grid-column: 1 / -1;
}

.rating-list-item {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1rem;
  background: #fbfdff;
}

.rating-list-item p {
  margin: 0.35rem 0;
  color: var(--text);
}

.rating-list-item span {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 700;
}

@media (max-width: 860px) {
  .ratings-layout {
    grid-template-columns: 1fr;
  }

  .ratings-list-card {
    grid-column: auto;
  }
}
</style>