<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

const displayName = computed(() => {
  return authStore.user?.fullName ?? authStore.user?.name ?? authStore.user?.email
})

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">D</div>
        <div>
          <h1>Dentia</h1>
          <p>Panel clínico</p>
        </div>
      </div>

      <nav class="nav">
        <RouterLink v-if="authStore.role === 'PATIENT'" to="/patient/dentists">
          Dentistas
        </RouterLink>

        <RouterLink v-if="authStore.role === 'DENTIST'" to="/dentist/dashboard">
          Agenda
        </RouterLink>

        <RouterLink v-if="authStore.role === 'ADMIN'" to="/admin/dashboard">
          Administración
        </RouterLink>
      </nav>

      <button class="logout-button" @click="logout">
        Cerrar sesión
      </button>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <strong>{{ displayName }}</strong>
          <span>{{ authStore.role }}</span>
        </div>
      </header>

      <section class="content">
        <slot />
      </section>
    </main>
  </div>
</template>