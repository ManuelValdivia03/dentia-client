<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { getAppointments, type Appointment } from '../modules/appointments/appointments.api'
import {
  deleteClinicalFile,
  downloadClinicalFile,
  getFiles,
  uploadClinicalFile,
  type ClinicalFile,
} from '../modules/files/files.api'
import {
  downloadPrescriptionPdf,
  getPrescriptionsByAppointment,
  type Prescription,
} from '../modules/prescriptions/prescriptions.api'
import { useAuthStore } from '../stores/auth.store'
import { getDentists } from '../modules/dentists/dentists.service'
import type { Dentist } from '../modules/dentists/dentists.types'

const authStore = useAuthStore()
const queryClient = useQueryClient()

const selectedFile = ref<File | null>(null)
const uploadError = ref('')
const prescriptionsByAppointment = ref<Record<string, Prescription[]>>({})

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
})

const filesQuery = useQuery({
  queryKey: ['files', authStore.user?.domainId],
  queryFn: () => getFiles(authStore.user?.domainId ? { patientId: authStore.user.domainId } : undefined),
})

const uploadMutation = useMutation({
  mutationFn: uploadClinicalFile,
  onSuccess: () => {
    selectedFile.value = null
    queryClient.invalidateQueries({ queryKey: ['files'] })
  },
})

const deleteMutation = useMutation({
  mutationFn: deleteClinicalFile,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['files'] })
  },
})

function normalizeStatus(status: string) {
  return status.toUpperCase()
}

function completedAppointments() {
  return (appointmentsQuery.data.value ?? []).filter((appointment) => {
    return normalizeStatus(appointment.status) === 'COMPLETED'
  })
}

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: getDentists,
})

const dentistNameById = computed(() => {
  return new Map(
    (dentistsQuery.data.value ?? []).map((dentist) => [
      dentist.domainId,
      dentistName(dentist),
    ]),
  )
})

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? dentist.domainId
}

function dentistDisplayName(dentistId: string) {
  return dentistNameById.value.get(dentistId) ?? dentistId
}

function fileId(file: ClinicalFile) {
  return file.id ?? file._id ?? ''
}

function formatDate(value?: string) {
  if (!value) return 'Sin fecha'

  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function submitFile() {
  uploadError.value = ''

  if (!selectedFile.value) {
    uploadError.value = 'Selecciona un archivo.'
    return
  }

  await uploadMutation.mutateAsync({
    file: selectedFile.value,
    patientId: authStore.user?.domainId,
  })
}

async function downloadFile(file: ClinicalFile) {
  const id = fileId(file)
  if (!id) return

  const blob = await downloadClinicalFile(id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.originalName
  link.click()
  URL.revokeObjectURL(url)
}

async function removeFile(file: ClinicalFile) {
  const id = fileId(file)
  if (!id) return

  const confirmed = window.confirm('¿Eliminar este archivo?')
  if (!confirmed) return

  await deleteMutation.mutateAsync(id)
}

async function loadPrescriptions(appointment: Appointment) {
  prescriptionsByAppointment.value[appointment.id] =
    await getPrescriptionsByAppointment(appointment.id)
}

async function downloadPrescription(prescription: Prescription) {
  const blob = await downloadPrescriptionPdf(prescription.id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `receta-${prescription.id}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Paciente</p>
        <h2>Historial médico</h2>
      </div>
    </div>

    <div class="section-block">
      <h3>Citas atendidas y recetas</h3>

      <p v-if="appointmentsQuery.isLoading.value">Cargando historial...</p>

      <div v-else-if="completedAppointments().length" class="list">
        <article
          v-for="appointment in completedAppointments()"
          :key="appointment.id"
          class="card"
        >
          <div class="card-header">
            <div>
              <h3>{{ appointment.reason ?? 'Cita odontológica' }}</h3>
              <p>{{ formatDate(appointment.startAt) }}</p>
            </div>
          </div>

          <p><strong>Dentista:</strong> {{ dentistDisplayName(appointment.dentistId) }}</p>

          <div class="card-actions">
            <button class="secondary-button inline-button" type="button" @click="loadPrescriptions(appointment)">
              Ver recetas
            </button>
          </div>

          <div v-if="prescriptionsByAppointment[appointment.id]?.length" class="nested-list">
            <div
              v-for="prescription in prescriptionsByAppointment[appointment.id]"
              :key="prescription.id"
              class="list-item"
            >
              <span>{{ prescription.diagnosis }}</span>
              <button class="secondary-button inline-button" type="button" @click="downloadPrescription(prescription)">
                Descargar PDF
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        Todavía no hay citas completadas.
      </div>
    </div>

    <div class="section-block">
      <h3>Archivos clínicos</h3>

      <form class="inline-form" @submit.prevent="submitFile">
        <label>
          Archivo clínico
          <small class="muted-text">
            Formatos permitidos: PDF, JPG o PNG. Peso máximo: 10 MB.
          </small>
          <input type="file" accept="application/pdf,image/png,image/jpeg" @change="onFileChange" />
        </label>
        <button class="primary-button inline-button" type="submit" :disabled="uploadMutation.isPending.value">
          Subir archivo
        </button>
      </form>

      <p v-if="uploadError" class="error-message">{{ uploadError }}</p>

      <p v-if="filesQuery.isLoading.value">Cargando archivos...</p>

      <div v-else-if="filesQuery.data.value?.length" class="list">
        <div v-for="file in filesQuery.data.value" :key="fileId(file)" class="list-item">
          <div>
            <strong>{{ file.originalName }}</strong>
            <p class="muted-text">{{ formatSize(file.size) }} · {{ formatDate(file.createdAt) }}</p>
          </div>

          <div class="row-actions">
            <button class="secondary-button inline-button" type="button" @click="downloadFile(file)">
              Descargar
            </button>
            <button class="secondary-button inline-button" type="button" @click="removeFile(file)">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        No hay archivos clínicos registrados.
      </div>
    </div>
  </AppLayout>
</template>
