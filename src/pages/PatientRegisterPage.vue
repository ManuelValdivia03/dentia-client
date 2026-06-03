<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

const router = useRouter()
const authStore = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const photo = ref<File | null>(null)

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
      role: 'PATIENT',
      photo: photo.value,
    })

    router.push({
      path: '/verify-email',
      query: { email: email.value },
    })
  } catch (error: any) {
    const responseMessage =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.response?.data

    errorMessage.value =
      typeof responseMessage === 'string'
        ? responseMessage
        : Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : 'No se pudo crear la cuenta'
  } finally {
    isLoading.value = false
  }
}

function handlePhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  photo.value = input.files?.[0] ?? null
}
</script>

<template>
  <main class="auth-split">
    <section class="auth-info">
      <div class="auth-info-content">
        <h2>Registro de paciente</h2>
        <p>
          Crea tu cuenta para encontrar doctores, agendar citas y consultar tu
          historial clínico.
        </p>

        <ul>
          <li>Agenda sin llamadas</li>
          <li>Consulta recetas e indicaciones</li>
          <li>Accede a tus archivos clínicos</li>
        </ul>
      </div>
    </section>

    <section class="auth-form-area">
      <div class="auth-card">
        <div class="auth-brand">
          <AppLogo size="lg" />
          <h1>Paciente</h1>
          <p>Datos de acceso</p>
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

          <label>
            Foto de perfil
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="handlePhotoChange"
            />
          </label>

          <p v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </p>

          <button class="primary-button" type="submit" :disabled="isLoading">
            {{ isLoading ? 'Creando...' : 'Crear cuenta' }}
          </button>
        </form>

        <p class="auth-link">
          <RouterLink to="/register">Cambiar tipo de cuenta</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>
