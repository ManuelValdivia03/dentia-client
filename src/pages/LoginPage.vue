<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    })

    router.push('/dashboard')
  } catch {
    errorMessage.value = 'Credenciales inválidas o API no disponible'
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
        <h1>Dentia</h1>
        <p>Inicia sesión para continuar</p>
      </div>

      <form @submit.prevent="handleLogin">
        <label>
          Correo electrónico
          <input v-model="email" type="email" required placeholder="usuario@dentia.com" />
        </label>

        <label>
          Contraseña
          <input v-model="password" type="password" required placeholder="********" />
        </label>

        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <p class="auth-link">
        ¿No tienes cuenta?
        <RouterLink to="/register">Crear cuenta</RouterLink>
      </p>
    </section>
  </main>
</template>