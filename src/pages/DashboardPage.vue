<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

const router = useRouter()
const authStore = useAuthStore()
const isSidebarCollapsed = ref(false)

const normalizedRole = computed(() => {
  return (authStore.role ?? authStore.user?.role ?? '').toString().toUpperCase()
})

const displayName = computed(() => {
  return authStore.user?.fullName ?? authStore.user?.name ?? authStore.user?.email ?? 'Usuario'
})

const userInitial = computed(() => {
  return displayName.value.charAt(0).toUpperCase()
})

const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    PATIENT: 'Portal de Pacientes',
    DENTIST: 'Panel clínico',
    ADMIN: 'Administración',
  }

  return labels[normalizedRole.value] ?? 'Dentia'
})

const roleBadge = computed(() => {
  const labels: Record<string, string> = {
    PATIENT: 'Paciente',
    DENTIST: 'Dentista',
    ADMIN: 'Administrador',
  }

  return labels[normalizedRole.value] ?? 'Usuario'
})

const navigationItems = computed(() => {
  if (normalizedRole.value === 'PATIENT') {
    return [
      { to: '/patient/dentists', label: 'Dentistas' },
      { to: '/patient/appointments', label: 'Mis citas' },
      { to: '/patient/history', label: 'Historial' },
      { to: '/patient/chat', label: 'Chat' },
      { to: '/profile', label: 'Perfil' },
    ]
  }

  if (normalizedRole.value === 'DENTIST') {
    return [
      { to: '/dentist/dashboard', label: 'Dashboard' },
      { to: '/dentist/agenda', label: 'Mi agenda' },
      { to: '/dentist/chat', label: 'Chat' },
      { to: '/profile', label: 'Perfil' },
    ]
  }

  if (normalizedRole.value === 'ADMIN') {
    return [
      { to: '/admin/dashboard', label: 'Administración' },
      { to: '/profile', label: 'Perfil' },
    ]
  }

  return [{ to: '/profile', label: 'Perfil' }]
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
    <aside class="app-sidebar">
      <button
        class="sidebar-toggle"
        type="button"
        :aria-label="isSidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'"
        @click="toggleSidebar"
      >
        {{ isSidebarCollapsed ? '›' : '‹' }}
      </button>

      <div class="sidebar-brand">
        <AppLogo size="lg" />
        <p class="sidebar-role">{{ roleLabel }}</p>
      </div>

      <nav class="sidebar-nav" aria-label="Navegación principal">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          class="sidebar-link"
          active-class="sidebar-link-active"
          :to="item.to"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <button class="sidebar-logout" type="button" @click="logout">
        Cerrar sesión
      </button>
    </aside>

    <main class="main">
      <header class="topbar">
        <button class="topbar-menu-button" type="button" @click="toggleSidebar">
          {{ isSidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú' }}
        </button>

        <div class="topbar-user">
          <div>
            <strong>{{ displayName }}</strong>
            <span>{{ roleBadge }}</span>
          </div>

          <div class="topbar-avatar">
            {{ userInitial }}
          </div>
        </div>
      </header>

      <section class="content">
        <slot />
      </section>
    </main>
  </div>
</template>