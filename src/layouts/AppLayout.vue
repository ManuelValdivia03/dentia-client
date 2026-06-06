<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

const router = useRouter()
const authStore = useAuthStore()
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

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <AppLogo size="lg" />
        <h1>Dentia</h1>
        <p>{{ roleLabel }}</p>
      </div>

      <nav class="nav">
        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/patient/dentists">
          Dentistas
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/patient/appointments">
          Mis citas
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/patient/history">
          Historial
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'PATIENT'" to="/chat">
          Chat
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/dentist/dashboard">
          Dashboard
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/dentist/agenda">
          Mi agenda
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'DENTIST'" to="/chat">
          Chat
        </RouterLink>

        <RouterLink v-if="normalizedRole === 'ADMIN'" to="/admin/dashboard">
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