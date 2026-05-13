<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

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
    } catch (error: any) {
    console.error('Login error:', error.response?.data ?? error)

    const responseMessage =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.response?.data

    errorMessage.value =
      typeof responseMessage === 'string'
        ? responseMessage
        : Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : 'No se pudo iniciar sesión'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="auth-split">
    <section class="auth-form-area">
      <div class="auth-card">
        <div class="auth-brand">
          <AppLogo size="lg" />
          <h1>Dentia</h1>
          <p>Bienvenido de nuevo</p>
        </div>

        <form @submit.prevent="handleLogin">
          <label>
            Correo electrónico
            <input
              v-model="email"
              type="email"
              required
              placeholder="usuario@dentia.com"
            />
          </label>

          <label>
            Contraseña
            <input
              v-model="password"
              type="password"
              required
              placeholder="********"
            />
          </label>

          <p v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </p>

          <button class="primary-button" type="submit" :disabled="isLoading">
            {{ isLoading ? 'Entrando...' : 'Iniciar sesión' }}
          </button>
        </form>

        <p class="auth-link">
          ¿No tienes una cuenta?
          <RouterLink to="/register">Crear cuenta</RouterLink>
        </p>
      </div>
    </section>

    <section class="auth-info">
      <div class="auth-info-content">
        <h2>Tu salud dental, digitalizada</h2>
        <p>
          Gestiona citas, recetas, archivos clínicos y comunicación entre
          pacientes y dentistas desde una sola plataforma.
        </p>

        <ul>
          <li>Agenda y disponibilidad centralizada</li>
          <li>Historial médico y recetas</li>
          <li>Archivos clínicos seguros</li>
          <li>Chat paciente–dentista</li>
        </ul>
      </div>
    </section>
  </main>
</template>