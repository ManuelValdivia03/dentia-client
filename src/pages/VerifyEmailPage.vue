<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const email = ref(
  typeof route.query.email === 'string' ? route.query.email : '',
)
const code = ref('')

const isVerifying = ref(false)
const isResending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const canSubmit = computed(() => {
  return email.value.trim().length > 0 && /^\d{6}$/.test(code.value)
})

async function handleVerifyEmail() {
  errorMessage.value = ''
  successMessage.value = ''
  isVerifying.value = true

  try {
    await authStore.verifyEmail({
      email: email.value,
      code: code.value,
    })

    successMessage.value = 'Correo verificado correctamente. Ya puedes iniciar sesión.'
    router.push('/login')
  } catch (error: any) {
    console.error('Verify email error:', error.response?.data ?? error)

    const responseMessage =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.response?.data

    errorMessage.value =
      typeof responseMessage === 'string'
        ? responseMessage
        : Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : 'No se pudo verificar el correo'
  } finally {
    isVerifying.value = false
  }
}

async function handleResendCode() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value) {
    errorMessage.value = 'Ingresa tu correo para reenviar el código'
    return
  }

  isResending.value = true

  try {
    await authStore.resendVerificationCode({
      email: email.value,
    })

    successMessage.value = 'Código reenviado. Revisa tu correo.'
  } catch (error: any) {
    console.error('Resend code error:', error.response?.data ?? error)

    const responseMessage =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.response?.data

    errorMessage.value =
      typeof responseMessage === 'string'
        ? responseMessage
        : Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : 'No se pudo reenviar el código'
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <main class="auth-split">
    <section class="auth-form-area">
      <div class="auth-card">
        <div class="auth-brand">
          <AppLogo size="lg" />
          <h1>Verifica tu correo</h1>
          <p>Ingresa el código de 6 dígitos que enviamos a tu correo.</p>
        </div>

        <form @submit.prevent="handleVerifyEmail">
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
            Código de verificación
            <input
              v-model="code"
              type="text"
              required
              maxlength="6"
              inputmode="numeric"
              placeholder="123456"
            />
          </label>

          <p v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </p>

          <p v-if="successMessage" class="success-message">
            {{ successMessage }}
          </p>

          <button class="primary-button" type="submit" :disabled="isVerifying || !canSubmit">
            {{ isVerifying ? 'Verificando...' : 'Verificar correo' }}
          </button>

          <button
            class="secondary-button"
            type="button"
            :disabled="isResending"
            @click="handleResendCode"
          >
            {{ isResending ? 'Reenviando...' : 'Reenviar código' }}
          </button>
        </form>

        <p class="auth-link">
          ¿Ya verificaste tu correo?
          <RouterLink to="/login">Iniciar sesión</RouterLink>
        </p>
      </div>
    </section>

    <section class="auth-info">
      <div class="auth-info-content">
        <h2>Un paso más para proteger tu cuenta</h2>
        <p>
          La verificación de correo ayuda a confirmar que la cuenta realmente
          pertenece a quien se está registrando.
        </p>

        <ul>
          <li>Protege el acceso a tu cuenta</li>
          <li>Evita registros con correos falsos</li>
          <li>Permite recuperar acceso después</li>
        </ul>
      </div>
    </section>
  </main>
</template>