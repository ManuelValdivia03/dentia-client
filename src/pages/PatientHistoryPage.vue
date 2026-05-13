<script setup lang="ts">
import AppLayout from '../layouts/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Paciente</p>
        <h2>Historial médico</h2>
      </div>
    </div>

    <div class="empty-state">
      Aquí se mostrarán citas atendidas, recetas y archivos clínicos.
    </div>
  </AppLayout>
</template>