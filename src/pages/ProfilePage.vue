<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'
import { getApiErrorMessage } from '../utils/api-error'

const authStore = useAuthStore()
const router = useRouter()

const fullName = ref(authStore.user?.fullName ?? authStore.user?.name ?? '')
const specialty = ref(authStore.user?.specialty ?? '')
const escuela = ref(authStore.user?.escuela ?? '')
const descripcion = ref(authStore.user?.descripcion ?? '')
const photo = ref<File | null>(null)
const localPhotoPreviewUrl = ref('')
const photoVersion = ref(Date.now())
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const photoInput = ref<HTMLInputElement | null>(null)

const initialProfile = ref({
  fullName: (authStore.user?.fullName ?? authStore.user?.name ?? '').trim(),
  specialty: (authStore.user?.specialty ?? '').trim(),
  escuela: (authStore.user?.escuela ?? '').trim(),
  descripcion: (authStore.user?.descripcion ?? '').trim(),
})

const isDentist = computed(() => authStore.role === 'DENTIST')

const hasProfileChanges = computed(() => {
  if (photo.value) {
    return true
  }

  if (fullName.value.trim() !== initialProfile.value.fullName) {
    return true
  }

  if (!isDentist.value) {
    return false
  }

  return (
    specialty.value.trim() !== initialProfile.value.specialty ||
    escuela.value.trim() !== initialProfile.value.escuela ||
    descripcion.value.trim() !== initialProfile.value.descripcion
  )
})

const profileName = computed(
  () => fullName.value || authStore.user?.email || 'Usuario',
)

const profileEmail = computed(
  () => authStore.user?.email ?? 'Correo no registrado',
)

const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    PATIENT: 'Paciente',
    DENTIST: 'Dentista',
    ADMIN: 'Administrador',
  }

  return labels[authStore.role ?? ''] ?? authStore.role
})

const profileSafeNote = computed(() =>
  isDentist.value
    ? 'Correo, contraseña y cédula profesional no se editan desde esta ventana.'
    : 'Correo y contraseña no se editan desde esta ventana.',
)

const photoUrl = computed(() => {
  if (localPhotoPreviewUrl.value) {
    return localPhotoPreviewUrl.value
  }

  const url = authStore.user?.photoUrl
  if (!url) return ''

  const normalizedUrl = url.startsWith('http')
    ? url
    : `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}${url}`

  const separator = normalizedUrl.includes('?') ? '&' : '?'
  return `${normalizedUrl}${separator}v=${photoVersion.value}`
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
  const selectedPhoto = input.files?.[0] ?? null
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxSizeBytes = 5 * 1024 * 1024

  if (selectedPhoto && !allowedTypes.includes(selectedPhoto.type)) {
    errorMessage.value = 'Formato no compatible. Usa JPG, PNG o WEBP.'
    photo.value = null
    input.value = ''
    return
  }

  if (selectedPhoto && selectedPhoto.size > maxSizeBytes) {
    errorMessage.value = 'La foto supera el tamaño máximo de 5 MB.'
    photo.value = null
    input.value = ''
    return
  }

  if (localPhotoPreviewUrl.value) {
    URL.revokeObjectURL(localPhotoPreviewUrl.value)
    localPhotoPreviewUrl.value = ''
  }

  photo.value = selectedPhoto
  successMessage.value = ''
  errorMessage.value = ''

  if (selectedPhoto) {
    localPhotoPreviewUrl.value = URL.createObjectURL(selectedPhoto)
  }
}

onBeforeUnmount(() => {
  if (localPhotoPreviewUrl.value) {
    URL.revokeObjectURL(localPhotoPreviewUrl.value)
  }
})

async function saveProfile() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!hasProfileChanges.value) {
    successMessage.value = 'No hay cambios por guardar.'
    return
  }

  isSaving.value = true

  try {
    const nextProfile = {
      fullName: fullName.value.trim(),
      specialty: specialty.value.trim(),
      escuela: escuela.value.trim(),
      descripcion: descripcion.value.trim(),
    }

    await authStore.updateProfile({
      fullName: nextProfile.fullName,
      specialty: isDentist.value ? nextProfile.specialty || undefined : undefined,
      escuela: isDentist.value ? nextProfile.escuela || undefined : undefined,
      descripcion: isDentist.value ? nextProfile.descripcion || undefined : undefined,
      photo: photo.value,
    })

    initialProfile.value = nextProfile
    successMessage.value = 'Perfil actualizado correctamente.'
    photo.value = null
    photoVersion.value = Date.now()

    if (localPhotoPreviewUrl.value) {
      URL.revokeObjectURL(localPhotoPreviewUrl.value)
      localPhotoPreviewUrl.value = ''
    }

    if (photoInput.value) {
      photoInput.value.value = ''
    }
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

function closeProfile() {
  router.push('/dashboard')
}
</script>

<template>
  <AppLayout>
    <div class="modal-backdrop" @click.self="closeProfile">
      <section class="modal-panel profile-modal-panel" role="dialog" aria-modal="true">
        <div class="modal-header">
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

            <h3>{{ profileName }}</h3>
            <p>{{ profileEmail }}</p>
            <span class="badge">{{ roleLabel }}</span>

            <div class="profile-safe-note">
              {{ profileSafeNote }}
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
                  Correo electrónico
                  <input :value="profileEmail" type="email" disabled />
                </label>

                <label>
                  Tipo de cuenta
                  <input :value="roleLabel" type="text" disabled />
                </label>

                <label>
                  Foto de perfil
                  <small class="muted-text">
                    Formatos permitidos: JPG, PNG o WEBP. Peso máximo: 5 MB.
                  </small>
                  <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" @change="onPhotoChange"/>
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

              <div class="profile-actions">
                <button
                  class="profile-action-button profile-action-secondary"
                  type="button"
                  @click="closeProfile"
                >
                  Cerrar
                </button>

                <button
                  class="profile-action-button profile-action-primary"
                  type="submit"
                  :disabled="isSaving || !hasProfileChanges"
                >
                  {{ isSaving ? 'Guardando...' : hasProfileChanges ? 'Guardar perfil' : 'Sin cambios' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.profile-actions {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding-top: 1rem;
  background: #fff;
}

.profile-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 4rem;
  width: 100%;
  border-radius: 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.profile-action-secondary {
  border: 1px solid #d8e2ec;
  background: #fff;
  color: #172033;
}

.profile-action-primary {
  border: 1px solid #0f6b85;
  background: #0f6b85;
  color: #fff;
}

.profile-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
</style>
