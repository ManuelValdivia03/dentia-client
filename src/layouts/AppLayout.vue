<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

const router = useRouter()
const authStore = useAuthStore()
const isSidebarCollapsed = ref(false)
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
const normalizedRole = computed(() =>
  String(authStore.role ?? authStore.user?.role ?? '').toUpperCase(),
)

const displayName = computed(() => {
  return (
    authStore.user?.fullName ??
    authStore.user?.name ??
    authStore.user?.email ??
    'Usuario'
  )
})

const roleLabel = computed(() => {
  if (normalizedRole.value === 'PATIENT') return 'Portal de Pacientes'
  if (normalizedRole.value === 'DENTIST') return 'Panel clínico'
  if (normalizedRole.value === 'ADMIN') return 'Administración'

  return 'Dentia'
})

const roleBadge = computed(() => {
  if (normalizedRole.value === 'PATIENT') return 'Paciente'
  if (normalizedRole.value === 'DENTIST') return 'Dentista'
  if (normalizedRole.value === 'ADMIN') return 'Administrador'

  return 'Usuario'
})

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell-sidebar-collapsed': isSidebarCollapsed }">
    <aside class="sidebar">
      <button
        class="sidebar-toggle-button"
        type="button"
        :aria-label="isSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'"
        @click="toggleSidebar"
      >
        <svg
          class="sidebar-toggle-icon"
          :class="{ 'sidebar-toggle-icon-collapsed': isSidebarCollapsed }"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M15 6L9 12L15 18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="sidebar-brand">
        <AppLogo size="lg" />
        <h1>Dentia</h1>
        <p>{{ roleLabel }}</p>
      </div>

      <nav class="nav">
        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/patient/dentists">
          <span class="nav-link-text">Dentistas</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/patient/appointments">
          <span class="nav-link-text">Mis citas</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/patient/history">
          <span class="nav-link-text">Historial</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/chat">
          <span class="nav-link-text">Chat</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/dentist/dashboard">
          <span class="nav-link-text">Dashboard</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/dentist/agenda">
          <span class="nav-link-text">Mi agenda</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/chat">
          <span class="nav-link-text">Chat</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/dentist/ratings">
          <span class="nav-link-text">Valoraciones</span>
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'ADMIN'" to="/admin/dashboard">
          <span class="nav-link-text">Administración</span>
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
          <span>{{ roleBadge }}</span>
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