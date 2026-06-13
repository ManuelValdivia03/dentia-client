<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { getApiErrorMessage } from '../utils/api-error'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { getMyClinicalRecord } from '../modules/clinical-records/clinical-records.api'

const authStore = useAuthStore()
const queryClient = useQueryClient()

const selectedFile = ref<File | null>(null)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploadSuccess = ref('')
const fileActionError = ref('')
const fileActionSuccess = ref('')
const prescriptionActionErrors = ref<Record<string, string>>({})
const prescriptionLoadingByAppointment = ref<Record<string, boolean>>({})
const loadedPrescriptionAppointmentIds = ref(new Set<string>())
const expandedPrescriptionAppointmentIds = ref(new Set<string>())

const deleteFileModal = ref<{
  open: boolean
  file: ClinicalFile | null
}>({
  open: false,
  file: null,
})

const deleteFileMessage = computed(() => {
  const fileName = deleteFileModal.value.file?.originalName ?? 'este archivo'
  return `Esta acción eliminará ${fileName} del historial clínico.`
})
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ALLOWED_FILE_LABEL = 'PDF, JPG o PNG'
const prescriptionsByAppointment = ref<Record<string, Prescription[]>>({})

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
})

const filesQuery = useQuery({
  queryKey: ['files', authStore.user?.domainId],
  queryFn: () => getFiles(authStore.user?.domainId ? { patientId: authStore.user.domainId } : undefined),
})

const clinicalRecordQuery = useQuery({
  queryKey: ['clinical-records', 'me'],
  queryFn: () => getMyClinicalRecord(),
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

watch(
  () => completedAppointments().map((appointment) => appointment.id).join('|'),
  () => {
    completedAppointments().forEach((appointment) => {
      preloadPrescriptions(appointment)
    })
  },
  { immediate: true },
)

const dentistNameById = computed(() => {
  return new Map(
    (dentistsQuery.data.value ?? []).map((dentist) => [
      dentist.domainId,
      dentistName(dentist),
    ]),
  )
})

const appointmentsErrorMessage = computed(() => {
  if (!appointmentsQuery.error.value) return ''
  return getApiErrorMessage(appointmentsQuery.error.value)
})

const filesErrorMessage = computed(() => {
  if (!filesQuery.error.value) return ''
  return getApiErrorMessage(filesQuery.error.value)
})

const clinicalRecordErrorMessage = computed(() => {
  if (!clinicalRecordQuery.error.value) return ''
  return getApiErrorMessage(clinicalRecordQuery.error.value)
})

const dentistsErrorMessage = computed(() => {
  if (!dentistsQuery.error.value) return ''
  return getApiErrorMessage(dentistsQuery.error.value)
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
  const file = input.files?.[0] ?? null

  uploadError.value = ''
  uploadSuccess.value = ''
  fileActionError.value = ''
  fileActionSuccess.value = ''

  if (!file) {
    selectedFile.value = null
    return
  }

  const validationError = validateClinicalFile(file)

  if (validationError) {
    uploadError.value = validationError
    selectedFile.value = null
    input.value = ''
    return
  }

  selectedFile.value = file
}

async function submitFile() {
  uploadError.value = ''
  uploadSuccess.value = ''
  fileActionError.value = ''
  fileActionSuccess.value = ''

  if (!selectedFile.value) {
    uploadError.value = 'Selecciona un archivo.'
    return
  }

  const validationError = validateClinicalFile(selectedFile.value)

  if (validationError) {
    uploadError.value = validationError
    return
  }

  try {
    await uploadMutation.mutateAsync({
      file: selectedFile.value,
      patientId: authStore.user?.domainId,
    })

    uploadSuccess.value = 'Archivo subido correctamente.'

    if (fileInput.value) {
      fileInput.value.value = ''
    }
  } catch (error: unknown) {
    uploadError.value = getApiErrorMessage(error)
  }
}

async function downloadFile(file: ClinicalFile) {
  const id = fileId(file)
  if (!id) return

  fileActionError.value = ''
  fileActionSuccess.value = ''

  try {
    const blob = await downloadClinicalFile(id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.originalName
    link.click()
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    fileActionError.value = getApiErrorMessage(error)
  }
}

function openDeleteFileConfirmation(file: ClinicalFile) {
  fileActionError.value = ''
  fileActionSuccess.value = ''

  deleteFileModal.value = {
    open: true,
    file,
  }
}

function closeDeleteFileConfirmation() {
  deleteFileModal.value = {
    open: false,
    file: null,
  }
}

async function confirmDeleteFile() {
  const file = deleteFileModal.value.file
  if (!file) return

  const id = fileId(file)
  if (!id) return

  closeDeleteFileConfirmation()

  fileActionError.value = ''
  fileActionSuccess.value = ''

  try {
    await deleteMutation.mutateAsync(id)
    fileActionSuccess.value = 'Archivo eliminado correctamente.'
  } catch (error: unknown) {
    fileActionError.value = getApiErrorMessage(error)
  }
}

function isPrescriptionLoading(appointment: Appointment) {
  return Boolean(prescriptionLoadingByAppointment.value[appointment.id])
}

function hasLoadedPrescriptions(appointment: Appointment) {
  return loadedPrescriptionAppointmentIds.value.has(appointment.id)
}

function hasPrescriptions(appointment: Appointment) {
  return Boolean(prescriptionsByAppointment.value[appointment.id]?.length)
}

function isPrescriptionExpanded(appointment: Appointment) {
  return expandedPrescriptionAppointmentIds.value.has(appointment.id)
}

function togglePrescriptions(appointment: Appointment) {
  const next = new Set(expandedPrescriptionAppointmentIds.value)

  if (next.has(appointment.id)) {
    next.delete(appointment.id)
  } else {
    next.add(appointment.id)
  }

  expandedPrescriptionAppointmentIds.value = next
}

async function preloadPrescriptions(appointment: Appointment) {
  if (
    hasLoadedPrescriptions(appointment) ||
    isPrescriptionLoading(appointment)
  ) {
    return
  }

  prescriptionLoadingByAppointment.value = {
    ...prescriptionLoadingByAppointment.value,
    [appointment.id]: true,
  }

  prescriptionActionErrors.value = {
    ...prescriptionActionErrors.value,
    [appointment.id]: '',
  }

  try {
    const prescriptions = await getPrescriptionsByAppointment(appointment.id)

    prescriptionsByAppointment.value = {
      ...prescriptionsByAppointment.value,
      [appointment.id]: prescriptions,
    }

    loadedPrescriptionAppointmentIds.value = new Set([
      ...loadedPrescriptionAppointmentIds.value,
      appointment.id,
    ])
  } catch (error: unknown) {
    prescriptionActionErrors.value = {
      ...prescriptionActionErrors.value,
      [appointment.id]: getApiErrorMessage(error),
    }
  } finally {
    prescriptionLoadingByAppointment.value = {
      ...prescriptionLoadingByAppointment.value,
      [appointment.id]: false,
    }
  }
}

async function downloadPrescription(prescription: Prescription) {
  try {
    const blob = await downloadPrescriptionPdf(prescription.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `receta-${prescription.id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    fileActionError.value = getApiErrorMessage(error)
  }
}

const clinicalRecord = computed(() => clinicalRecordQuery.data.value)

const clinicalEncounters = computed(() => {
  return clinicalRecord.value?.encounters ?? []
})

const hasClinicalBackground = computed(() => {
  const record = clinicalRecord.value

  if (!record) return false

  return Boolean(
    record.bloodType ||
      record.allergies ||
      record.chronicDiseases ||
      record.currentMedications ||
      record.surgicalHistory ||
      record.familyHistory ||
      record.dentalHistory ||
      record.riskNotes,
  )
})

function clinicalValue(value?: string | null) {
  return value?.trim() || 'Sin registrar'
}

function validateClinicalFile(file: File) {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `Formato no compatible. Usa ${ALLOWED_FILE_LABEL}.`
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `El archivo supera el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`
  }

  return ''
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
      <h3>Expediente clínico</h3>

      <p v-if="clinicalRecordQuery.isLoading.value">Cargando expediente...</p>

      <p v-else-if="clinicalRecordQuery.isError.value" class="error-message">
        {{ clinicalRecordErrorMessage }}
      </p>

      <template v-else>
        <div class="record-summary-grid">
          <div class="record-field">
            <span>Tipo de sangre</span>
            <strong>{{ clinicalValue(clinicalRecord?.bloodType) }}</strong>
          </div>

          <div class="record-field">
            <span>Alergias</span>
            <strong>{{ clinicalValue(clinicalRecord?.allergies) }}</strong>
          </div>

          <div class="record-field">
            <span>Enfermedades crónicas</span>
            <strong>{{ clinicalValue(clinicalRecord?.chronicDiseases) }}</strong>
          </div>

          <div class="record-field">
            <span>Medicamentos actuales</span>
            <strong>{{ clinicalValue(clinicalRecord?.currentMedications) }}</strong>
          </div>

          <div class="record-field">
            <span>Antecedentes quirúrgicos</span>
            <strong>{{ clinicalValue(clinicalRecord?.surgicalHistory) }}</strong>
          </div>

          <div class="record-field">
            <span>Antecedentes familiares</span>
            <strong>{{ clinicalValue(clinicalRecord?.familyHistory) }}</strong>
          </div>

          <div class="record-field">
            <span>Antecedentes dentales</span>
            <strong>{{ clinicalValue(clinicalRecord?.dentalHistory) }}</strong>
          </div>

          <div class="record-field">
            <span>Notas de riesgo</span>
            <strong>{{ clinicalValue(clinicalRecord?.riskNotes) }}</strong>
          </div>
        </div>

        <p v-if="!hasClinicalBackground" class="muted-text">
          Aún no hay antecedentes clínicos registrados.
        </p>

        <div class="section-subheader">
          <h4>Consultas clínicas</h4>
        </div>

        <div v-if="clinicalEncounters.length" class="list">
          <article
            v-for="encounter in clinicalEncounters"
            :key="encounter.id"
            class="card"
          >
            <div class="card-header">
              <div>
                <h3>{{ encounter.reasonForVisit }}</h3>
                <p>{{ formatDate(encounter.createdAt) }}</p>
              </div>
            </div>

            <p>
              <strong>Dentista:</strong>
              {{ dentistDisplayName(encounter.dentistId) }}
            </p>

            <p>
              <strong>Diagnóstico:</strong>
              {{ encounter.diagnosis }}
            </p>

            <p v-if="encounter.symptoms">
              <strong>Síntomas:</strong>
              {{ encounter.symptoms }}
            </p>

            <p v-if="encounter.treatmentPerformed">
              <strong>Tratamiento realizado:</strong>
              {{ encounter.treatmentPerformed }}
            </p>

            <p v-if="encounter.treatmentPlan">
              <strong>Plan de tratamiento:</strong>
              {{ encounter.treatmentPlan }}
            </p>

            <p v-if="encounter.observations">
              <strong>Observaciones:</strong>
              {{ encounter.observations }}
            </p>
          </article>
        </div>

        <div v-else class="empty-state">
          Aún no hay consultas clínicas registradas.
        </div>
      </template>
    </div>

    <div class="section-block">
      <h3>Citas atendidas y recetas</h3>

      <p v-if="appointmentsQuery.isLoading.value">Cargando historial...</p>

      <p v-else-if="appointmentsQuery.isError.value" class="error-message">
        {{ appointmentsErrorMessage }}
      </p>

      <template v-else>
        <p v-if="dentistsQuery.isError.value" class="error-message">
          {{ dentistsErrorMessage }}
        </p>

        <div v-if="completedAppointments().length" class="list">
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

            <p>
              <strong>Dentista:</strong>
              {{ dentistDisplayName(appointment.dentistId) }}
            </p>

            <div class="card-actions">
              <button
                v-if="hasPrescriptions(appointment)"
                class="secondary-button inline-button"
                type="button"
                @click="togglePrescriptions(appointment)"
              >
                {{ isPrescriptionExpanded(appointment) ? 'Ocultar recetas' : 'Ver recetas' }}
              </button>

              <button
                v-else-if="isPrescriptionLoading(appointment)"
                class="secondary-button inline-button"
                type="button"
                disabled
              >
                Consultando recetas...
              </button>

              <span
                v-else-if="hasLoadedPrescriptions(appointment)"
                class="muted-text"
              >
                Sin receta registrada.
              </span>
            </div>

            <p
              v-if="prescriptionActionErrors[appointment.id]"
              class="error-message"
            >
              {{ prescriptionActionErrors[appointment.id] }}
            </p>

            <div
              v-if="hasPrescriptions(appointment) && isPrescriptionExpanded(appointment)"
              class="nested-list"
            >
              <div
                v-for="prescription in prescriptionsByAppointment[appointment.id]"
                :key="prescription.id"
                class="list-item"
              >
                <span>{{ prescription.diagnosis }}</span>

                <button
                  class="secondary-button inline-button"
                  type="button"
                  @click="downloadPrescription(prescription)"
                >
                  Descargar PDF
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          Todavía no hay citas completadas.
        </div>
      </template>
    </div>

    <div class="section-block">
      <h3>Archivos clínicos</h3>

      <form class="inline-form" @submit.prevent="submitFile">
        <label>
          Archivo clínico
          <small class="muted-text">
            Formatos permitidos: {{ ALLOWED_FILE_LABEL }}. Peso máximo:
            {{ MAX_FILE_SIZE_MB }} MB.
          </small>

          <input
            ref="fileInput"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            @change="onFileChange"
          />
        </label>

        <button
          class="primary-button inline-button"
          type="submit"
          :disabled="uploadMutation.isPending.value"
        >
          {{ uploadMutation.isPending.value ? 'Subiendo...' : 'Subir archivo' }}
        </button>
      </form>

      <p v-if="uploadError" class="error-message">
        {{ uploadError }}
      </p>

      <p v-if="uploadSuccess" class="success-message">
        {{ uploadSuccess }}
      </p>

      <p v-if="fileActionError" class="error-message">
        {{ fileActionError }}
      </p>

      <p v-if="fileActionSuccess" class="success-message">
        {{ fileActionSuccess }}
      </p>

      <p v-if="filesQuery.isLoading.value">Cargando archivos...</p>

      <p v-else-if="filesQuery.isError.value" class="error-message">
        {{ filesErrorMessage }}
      </p>

      <div v-else-if="filesQuery.data.value?.length" class="list">
        <div
          v-for="file in filesQuery.data.value"
          :key="fileId(file)"
          class="list-item"
        >
          <div>
            <strong>{{ file.originalName }}</strong>
            <p class="muted-text">
              {{ formatSize(file.size) }} · {{ formatDate(file.createdAt) }}
            </p>
          </div>

          <div class="row-actions">
            <button
              class="secondary-button inline-button"
              type="button"
              @click="downloadFile(file)"
            >
              Descargar
            </button>

            <button
              class="secondary-button inline-button"
              type="button"
              @click="openDeleteFileConfirmation(file)"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        No hay archivos clínicos registrados.
      </div>
    </div>
    <ConfirmDialog
      :open="deleteFileModal.open"
      variant="danger"
      title="Eliminar archivo"
      :message="deleteFileMessage"
      confirm-text="Sí, eliminar archivo"
      cancel-text="Conservar archivo"
      :loading="deleteMutation.isPending.value"
      @confirm="confirmDeleteFile"
      @cancel="closeDeleteFileConfirmation"
    />
  </AppLayout>
</template>

<style scoped>

.confirmation-dialog .eyebrow {
  margin-bottom: 8px;
}

.danger-button:hover {
  background: #b91c1c;
}

.danger-button:disabled,
.confirmation-actions .secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.confirmation-actions .secondary-button {
  border-radius: 999px;
  padding: 12px 20px;
}

.record-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.record-field {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid #d8e2ec;
  border-radius: 18px;
  background: #ffffff;
}

.record-field span {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 700;
}

.record-field strong {
  color: #172033;
  font-weight: 800;
}

.section-subheader {
  margin-top: 1.5rem;
}

.section-subheader h4 {
  margin: 0;
  color: #172033;
}
</style>