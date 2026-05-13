<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

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
      <div class="sidebar-brand">
        <AppLogo size="sm" />
        <p>Panel clínico</p>
      </div>

      <nav class="nav">
        <RouterLink v-if="authStore.role === 'PATIENT'" to="/patient/dentists">
          Dentistas
        </RouterLink>

        <RouterLink v-if="authStore.role === 'PATIENT'" to="/patient/appointments">
          Mis citas
        </RouterLink>

        <RouterLink v-if="authStore.role === 'PATIENT'" to="/patient/history">
          Historial
        </RouterLink>

        <RouterLink v-if="authStore.role === 'DENTIST'" to="/dentist/dashboard">
          Dashboard
        </RouterLink>

        <RouterLink v-if="authStore.role === 'DENTIST'" to="/dentist/agenda">
          Mi agenda
        </RouterLink>

        <RouterLink v-if="authStore.role === 'ADMIN'" to="/admin/dashboard">
          Administración
        </RouterLink>
      </nav>

      <button class="logout-button" type="button" @click="logout">
        Cerrar sesión
      </button>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-user">
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