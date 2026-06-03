<script setup lang="ts">
import { computed, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'

const authStore = useAuthStore()

const fullName = ref(authStore.user?.fullName ?? authStore.user?.name ?? '')
const specialty = ref(authStore.user?.specialty ?? '')
const escuela = ref(authStore.user?.escuela ?? '')
const descripcion = ref(authStore.user?.descripcion ?? '')
const photo = ref<File | null>(null)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isDentist = computed(() => authStore.role === 'DENTIST')

const photoUrl = computed(() => {
  const url = authStore.user?.photoUrl
  if (!url) return ''

  if (url.startsWith('http')) return url

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${baseUrl}${url}`
})

const initials = computed(() => {
  const name = fullName.value || authStore.user?.email || 'U'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
})

function onPhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  photo.value = input.files?.[0] ?? null
}

async function saveProfile() {
  errorMessage.value = ''
  successMessage.value = ''
  isSaving.value = true

  try {
    await authStore.updateProfile({
      fullName: fullName.value,
      specialty: isDentist.value ? specialty.value || undefined : undefined,
      escuela: isDentist.value ? escuela.value || undefined : undefined,
      descripcion: isDentist.value ? descripcion.value || undefined : undefined,
      photo: photo.value,
    })

    successMessage.value = 'Perfil actualizado correctamente.'
    photo.value = null
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
          : 'No se pudo actualizar el perfil'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Mi cuenta</p>
        <h2>Perfil</h2>
      </div>
    </div>

    <div class="profile-grid">
      <aside class="card profile-summary">
        <div class="profile-photo-preview">
          <img v-if="photoUrl" :src="photoUrl" alt="Foto de perfil" />
          <span v-else>{{ initials }}</span>
        </div>

        <h3>{{ authStore.user?.fullName ?? authStore.user?.email }}</h3>
        <p>{{ authStore.user?.email }}</p>
        <span class="badge">{{ authStore.role }}</span>

        <div class="profile-safe-note">
          Correo, contraseña y cédula profesional no se editan desde esta ventana.
        </div>
      </aside>

      <section class="card">
        <form @submit.prevent="saveProfile">
          <fieldset class="form-section">
            <legend>Datos generales</legend>

            <label>
              Nombre completo
              <input v-model="fullName" type="text" required minlength="3" />
            </label>

            <label>
              Foto de perfil
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="onPhotoChange" />
            </label>
          </fieldset>

          <fieldset v-if="isDentist" class="form-section">
            <legend>Datos profesionales</legend>

            <label>
              Especialidad
              <input v-model="specialty" type="text" />
            </label>

            <label>
              Escuela de egreso
              <input v-model="escuela" type="text" minlength="3" />
            </label>

            <label>
              Descripción profesional
              <textarea v-model="descripcion" rows="5" minlength="10" />
            </label>
          </fieldset>

          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
          <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

          <button class="primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? 'Guardando...' : 'Guardar perfil' }}
          </button>
        </form>
      </section>
    </div>
  </AppLayout>
</template>
