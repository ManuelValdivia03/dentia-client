<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppLogo from '../components/AppLogo.vue'
import { useAuthStore } from '../stores/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const email = ref(
  typeof route.query.email === 'string' ? route.query.email : '',
)
const isLoading = ref(false)
const errorMessage = ref('')

function getErrorMessage(error: any) {
  const responseMessage =
    error.response?.data?.message ??
    error.response?.data?.error ??
    error.response?.data

  if (typeof responseMessage === 'string') return responseMessage
  if (Array.isArray(responseMessage)) return responseMessage.join(', ')

  return 'No se pudo solicitar el código de recuperación'
}

async function handleRequestCode() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    const normalizedEmail = email.value.trim()
    await authStore.requestPasswordReset({ email: normalizedEmail })

    await router.push({
      path: '/reset-password',
      query: { email: normalizedEmail },
    })
  } catch (error: any) {
    console.error('Forgot password error:', error.response?.data ?? error)
    errorMessage.value = getErrorMessage(error)
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
          <h1>Recupera tu cuenta</h1>
          <p>Te enviaremos un código para cambiar tu contraseña.</p>
        </div>

        <form @submit.prevent="handleRequestCode">
          <label>
            Correo electrónico
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="usuario@dentia.com"
            />
          </label>

          <p v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </p>

          <button class="primary-button" type="submit" :disabled="isLoading">
            {{ isLoading ? 'Enviando...' : 'Enviar código' }}
          </button>
        </form>

        <p class="auth-link">
          <RouterLink to="/login">Volver a iniciar sesión</RouterLink>
        </p>
      </div>
    </section>

    <section class="auth-info">
      <div class="auth-info-content">
        <h2>Recuperación segura</h2>
        <p>
          El código solo se envía a cuentas verificadas y tiene una vigencia
          limitada.
        </p>

        <ul>
          <li>Código personal de 6 dígitos</li>
          <li>Protección contra intentos repetidos</li>
          <li>Cierre de sesiones activas al cambiar la contraseña</li>
        </ul>
      </div>
    </section>
  </main>
</template>
