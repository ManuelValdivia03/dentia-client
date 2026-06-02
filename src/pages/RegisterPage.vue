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
const role = ref<'PATIENT' | 'DENTIST'>('PATIENT')
const cedulaProfesional = ref('')
const escuela = ref('')
const descripcion = ref('')
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
      role: role.value,
      cedulaProfesional:
        role.value === 'DENTIST' ? cedulaProfesional.value : undefined,
      escuela: role.value === 'DENTIST' ? escuela.value : undefined,
      descripcion: role.value === 'DENTIST' ? descripcion.value : undefined,
      photo: photo.value,
    })

    router.push({
      path: '/verify-email',
      query: {
        email: email.value,
      },
    })
  } catch (error: any) {
    console.error('Register error:', error.response?.data ?? error)

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
        <h2>Únete a la revolución dental</h2>
        <p>
          Crea una cuenta para encontrar dentistas, agendar citas y consultar tu
          historial desde un solo lugar.
        </p>

        <ul>
          <li>Encuentra dentistas afiliados</li>
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
          <h1>Crear cuenta</h1>
          <p>Registro en Dentia</p>
        </div>

        <form @submit.prevent="handleRegister">
          <label>
            Tipo de cuenta
            <select v-model="role" required>
              <option value="PATIENT">Paciente</option>
              <option value="DENTIST">Dentista</option>
            </select>
          </label>

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

          <label v-if="role === 'DENTIST'">
            Cedula profesional
            <input
              v-model="cedulaProfesional"
              type="text"
              inputmode="numeric"
              required
              minlength="7"
              maxlength="8"
            />
          </label>

          <label v-if="role === 'DENTIST'">
            Escuela de egreso
            <input v-model="escuela" type="text" required minlength="3" />
          </label>

          <label v-if="role === 'DENTIST'">
            Descripcion profesional
            <textarea
              v-model="descripcion"
              required
              minlength="10"
              rows="4"
            />
          </label>

          <label>
            Foto de perfil
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :required="role === 'DENTIST'"
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
          ¿Ya tienes cuenta?
          <RouterLink to="/login">Iniciar sesión</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>
