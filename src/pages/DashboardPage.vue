<script setup lang="ts">
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'

const authStore = useAuthStore()
</script>

<template>
  <AppLayout>
    <h2>Dashboard</h2>

    <div class="cards-grid">
      <article class="card">
        <h3>Rol actual</h3>
        <p>{{ authStore.user?.role }}</p>
      </article>

      <article class="card">
        <h3>Citas</h3>
        <p>Pendiente de conectar con appointments-service.</p>
      </article>

      <article class="card">
        <h3>Recetas</h3>
        <p>Pendiente de conectar con prescriptions-service.</p>
      </article>

      <article class="card">
        <h3>Reportes</h3>
        <p>Pendiente de conectar con reports-service.</p>
      </article>
    </div>
  </AppLayout>
</template>