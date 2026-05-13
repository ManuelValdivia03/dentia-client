<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

onMounted(() => {
  if (authStore.role === 'PATIENT') {
    router.replace('/patient/dentists')
    return
  }

  if (authStore.role === 'DENTIST') {
    router.replace('/dentist/dashboard')
    return
  }

  if (authStore.role === 'ADMIN') {
    router.replace('/admin/dashboard')
    return
  }

  authStore.logout()
  router.replace('/login')
})
</script>

<template>
  <main class="loading-page">
    Cargando...
  </main>
</template>