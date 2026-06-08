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
const specialty = ref('')
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
      role: 'DENTIST',
      specialty: specialty.value || undefined,
      cedulaProfesional: cedulaProfesional.value,
      escuela: escuela.value,
      descripcion: descripcion.value,
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
        <h2>Registro de doctor</h2>
        <p>
          Completa tus datos profesionales para aparecer en el directorio y
          atender pacientes desde Dentia.
        </p>

        <ul>
          <li>Perfil profesional con cédula</li>
          <li>Agenda clínica y confirmación de citas</li>
          <li>Recetas y seguimiento de pacientes</li>
        </ul>
      </div>
    </section>

    <section class="auth-form-area">
      <div class="auth-card register-card">
        <div class="auth-brand">
          <AppLogo size="lg" />
          <h1>Doctor</h1>
          <p>Datos de acceso y perfil profesional</p>
        </div>

        <form @submit.prevent="handleRegister">
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

          <fieldset class="form-section">
            <legend>Perfil profesional</legend>

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

            <label>
              Foto de perfil
              <small class="muted-text">
                Formatos permitidos: JPG, PNG o WEBP. Peso máximo: 5 MB.
              </small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
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
          <RouterLink to="/register">Cambiar tipo de cuenta</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>
