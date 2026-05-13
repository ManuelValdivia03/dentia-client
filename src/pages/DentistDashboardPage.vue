<script setup lang="ts">
import AppLayout from '../layouts/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Odontólogo</p>
        <h2>Agenda del día</h2>
      </div>
    </div>

    <div class="empty-state">
      Aquí conectaremos /appointments para confirmar, cancelar y completar citas.
    </div>
  </AppLayout>
</template>