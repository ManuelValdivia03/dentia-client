<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppLogo from '../components/AppLogo.vue'
import { useAuthStore } from '../stores/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const email = ref(
  typeof route.query.email === 'string' ? route.query.email : '',
)
const code = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const passwordIsValid = computed(() => {
  return (
    password.value.length >= 8 &&
    /[a-z]/.test(password.value) &&
    /[A-Z]/.test(password.value) &&
    /\d/.test(password.value)
  )
})

const canSubmit = computed(() => {
  return (
    email.value.trim().length > 0 &&
    /^\d{6}$/.test(code.value) &&
    passwordIsValid.value &&
    password.value === passwordConfirmation.value
  )
})

function getErrorMessage(error: any) {
  const responseMessage =
    error.response?.data?.message ??
    error.response?.data?.error ??
    error.response?.data

  if (typeof responseMessage === 'string') return responseMessage
  if (Array.isArray(responseMessage)) return responseMessage.join(', ')

  return 'No se pudo actualizar la contraseña'
}

async function handleResetPassword() {
  errorMessage.value = ''

  if (password.value !== passwordConfirmation.value) {
    errorMessage.value = 'Las contraseñas no coinciden'
    return
  }

  if (!passwordIsValid.value) {
    errorMessage.value =
      'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y número'
    return
  }

  isLoading.value = true

  try {
    await authStore.resetPassword({
      email: email.value.trim(),
      code: code.value,
      password: password.value,
    })

    await router.push({
      path: '/login',
      query: { passwordReset: 'success' },
    })
  } catch (error: any) {
    console.error('Reset password error:', error.response?.data ?? error)
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
          <h1>Crea una nueva contraseña</h1>
          <p>Ingresa el código que recibiste y elige una contraseña nueva.</p>
        </div>

        <form @submit.prevent="handleResetPassword">
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

          <label>
            Código de recuperación
            <input
              v-model="code"
              type="text"
              required
              maxlength="6"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="123456"
            />
          </label>

          <label>
            Nueva contraseña
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              placeholder="********"
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              v-model="passwordConfirmation"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              placeholder="********"
            />
          </label>

          <p class="auth-link">
            Debe incluir mayúscula, minúscula y al menos un número.
          </p>

          <p v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </p>

          <button
            class="primary-button"
            type="submit"
            :disabled="isLoading || !canSubmit"
          >
            {{ isLoading ? 'Actualizando...' : 'Cambiar contraseña' }}
          </button>
        </form>

        <p class="auth-link">
          ¿Necesitas otro código?
          <RouterLink :to="{ path: '/forgot-password', query: { email } }">
            Solicitar uno nuevo
          </RouterLink>
        </p>
      </div>
    </section>

    <section class="auth-info">
      <div class="auth-info-content">
        <h2>Protege tu acceso</h2>
        <p>
          Al completar el cambio se cerrarán las sesiones activas de tu cuenta.
        </p>

        <ul>
          <li>Usa una contraseña que no hayas utilizado antes</li>
          <li>Evita compartir el código de recuperación</li>
          <li>El código expira después de unos minutos</li>
        </ul>
      </div>
    </section>
  </main>
</template>
