<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

async function handleRegister() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await authStore.register({
      fullName: fullName.value,
      email: email.value,
      password: password.value,
    })

    router.push('/login')
  } catch {
    errorMessage.value = 'No se pudo crear la cuenta'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="auth-brand">
        <div class="brand-mark large">D</div>
        <h1>Crear cuenta</h1>
        <p>Registro de paciente</p>
      </div>

      <form @submit.prevent="handleRegister">
        <label>
          Nombre completo
          <input v-model="fullName" type="text" required minlength="3" />
        </label>

        <label>
          Correo electrónico
          <input v-model="email" type="email" required />
        </label>

        <label>
          Contraseña
          <input v-model="password" type="password" required minlength="8" />
        </label>

        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Creando...' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="auth-link">
        ¿Ya tienes cuenta?
        <RouterLink to="/login">Iniciar sesión</RouterLink>
      </p>
    </section>
  </main>
</template>