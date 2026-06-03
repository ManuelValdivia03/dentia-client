<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppLogo from '../components/AppLogo.vue'

const router = useRouter()
const authStore = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const role = ref<'PATIENT' | 'DENTIST'>('PATIENT')
const specialty = ref('')
const cedulaProfesional = ref('')
const escuela = ref('')
const descripcion = ref('')
const photo = ref<File | null>(null)

const isLoading = ref(false)
const errorMessage = ref('')

const roleTitle = computed(() => {
  return role.value === 'PATIENT'
    ? 'Datos del paciente'
    : 'Perfil profesional'
})

async function handleRegister() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await authStore.register({
      fullName: fullName.value,
      email: email.value,
      password: password.value,
      role: role.value,
      specialty: role.value === 'DENTIST' ? specialty.value : undefined,
      cedulaProfesional:
        role.value === 'DENTIST' ? cedulaProfesional.value : undefined,
      escuela: role.value === 'DENTIST' ? escuela.value : undefined,
      descripcion: role.value === 'DENTIST' ? descripcion.value : undefined,
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
        <h2>Únete a Dentia</h2>
        <p>
          Crea tu cuenta con el flujo correcto para paciente o dentista usando
          los datos disponibles del sistema.
        </p>

        <ul>
          <li>Pacientes con historial, archivos y citas</li>
          <li>Dentistas con perfil profesional verificable</li>
          <li>Correo verificado antes de iniciar sesión</li>
          <li>Foto de perfil para identificarte dentro de la clínica</li>
        </ul>
      </div>
    </section>

    <section class="auth-form-area">
      <div class="auth-card register-card">
        <div class="auth-brand">
          <AppLogo size="lg" />
          <h1>Crear cuenta</h1>
          <p>Registro en Dentia</p>
        </div>

        <form @submit.prevent="handleRegister">
          <div class="segmented-control" role="radiogroup" aria-label="Tipo de cuenta">
            <button
              type="button"
              :class="{ active: role === 'PATIENT' }"
              @click="role = 'PATIENT'"
            >
              Paciente
            </button>
            <button
              type="button"
              :class="{ active: role === 'DENTIST' }"
              @click="role = 'DENTIST'"
            >
              Dentista
            </button>
          </div>

          <fieldset class="form-section">
            <legend>Acceso</legend>

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
          </fieldset>

          <fieldset v-if="role === 'DENTIST'" class="form-section">
            <legend>{{ roleTitle }}</legend>

            <label>
              Especialidad
              <input v-model="specialty" type="text" placeholder="Odontología general" />
            </label>

            <label>
              Cédula profesional
              <input
                v-model="cedulaProfesional"
                type="text"
                inputmode="numeric"
                required
                minlength="7"
                maxlength="8"
              />
            </label>

            <label>
              Escuela de egreso
              <input v-model="escuela" type="text" required minlength="3" />
            </label>

            <label>
              Descripción profesional
              <textarea
                v-model="descripcion"
                required
                minlength="10"
                rows="4"
              />
            </label>
          </fieldset>

          <fieldset class="form-section">
            <legend>Foto de perfil</legend>

            <label>
              Imagen
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :required="role === 'DENTIST'"
                @change="handlePhotoChange"
              />
            </label>
          </fieldset>

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
