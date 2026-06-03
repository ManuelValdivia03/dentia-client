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

const initials = computed(() => {
  const value = displayName.value ?? 'U'

  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
})

const photoUrl = computed(() => {
  const url = authStore.user?.photoUrl
  if (!url) return ''

  if (url.startsWith('http')) return url

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${baseUrl}${url}`
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
        <AppLogo size="md" />
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

        <RouterLink to="/chat">
          Chat
        </RouterLink>

        <RouterLink to="/profile">
          Perfil
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

        <RouterLink class="profile-orb" to="/profile" aria-label="Abrir perfil">
          <img v-if="photoUrl" :src="photoUrl" alt="" />
          <span v-else>{{ initials }}</span>
        </RouterLink>
      </header>

      <section class="content">
        <slot />
      </section>
    </main>
  </div>
</template>
