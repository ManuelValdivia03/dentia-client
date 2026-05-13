<script setup lang="ts">
import AppLayout from '../layouts/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Odontólogo</p>
        <h2>Mi agenda</h2>
      </div>
    </div>

    <div class="empty-state">
      Siguiente conexión: GET /appointments, confirmar y completar citas.
    </div>
  </AppLayout>
</template>