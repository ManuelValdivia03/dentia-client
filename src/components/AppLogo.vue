<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showText?: boolean
  }>(),
  {
    size: 'md',
    showText: true,
  },
)
</script>

<template>
  <div class="app-logo-wrapper" :class="size">
    <img src="../assets/dentia-logo.png" alt="Dentia" class="app-logo-image" />
  </div>
</template>