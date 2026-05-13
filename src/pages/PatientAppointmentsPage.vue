<script setup lang="ts">
import AppLayout from '../layouts/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Paciente</p>
        <h2>Mis citas</h2>
      </div>
    </div>

    <div class="empty-state">
      Siguiente conexión: GET /appointments y PATCH /appointments/:id/cancel.
    </div>
  </AppLayout>
</template>