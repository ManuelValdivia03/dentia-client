<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointments,
  getDentistDayAgenda,
  type Appointment,
} from '../modules/appointments/appointments.api'
import {
  createPrescription,
  getPrescriptionsByAppointment,
  type Prescription,
} from '../modules/prescriptions/prescriptions.api'
import {
  getUserByDomainId,
  userDisplayName,
} from '../modules/users/users.api'
import { useRoute, useRouter } from 'vue-router'
import { getApiErrorMessage } from '../utils/api-error'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const queryClient = useQueryClient()

const selectedDate = ref(getLocalDateValue(new Date()))
const calendarInputRef = ref<HTMLInputElement | null>(null)
const prescriptionTarget = ref<Appointment | null>(null)
const existingPrescription = ref<Prescription | null>(null)
const isLoadingPrescription = ref(false)
const prescriptionLookupFailed = ref(false)
const diagnosis = ref('')
const indications = ref('')
const prescriptionNotes = ref('')
const appointmentActionErrors = ref<Record<string, string>>({})
const prescriptionError = ref('')
const actionSuccess = ref('')

const appointmentsErrorMessage = computed(() => {
  if (!appointmentsQuery.error.value) return ''
  return getApiErrorMessage(appointmentsQuery.error.value)
})

const patientsErrorMessage = computed(() => {
  if (!patientsQuery.error.value) return ''
  return getApiErrorMessage(patientsQuery.error.value)
})

const prescriptionsErrorMessage = computed(() => {
  if (!prescriptionsByAppointmentQuery.error.value) return ''
  return getApiErrorMessage(prescriptionsByAppointmentQuery.error.value)
})

const route = useRoute()
const router = useRouter()

const showAllAppointments = ref(
  route.query.scope === 'all',
)

watch(
  () => route.query.scope,
  (scope) => {
    showAllAppointments.value = scope === 'all'
  },
)

const selectedStatus = ref(
  typeof route.query.status === 'string'
    ? normalizeStatus(route.query.status)
    : '',
)

watch(
  () => route.query.status,
  (status) => {
    selectedStatus.value =
      typeof status === 'string' ? normalizeStatus(status) : ''
  },
)

const appointmentsQuery = useQuery({
  queryKey: computed(() => [
    'appointments',
    'dentist-agenda',
    showAllAppointments.value ? 'all' : selectedDate.value,
  ]),
  queryFn: () => {
    if (showAllAppointments.value) {
      return getAppointments()
    }

    return getDentistDayAgenda(selectedDate.value)
  },
})

const selectedDateLabel = computed(() => formatAgendaDate(selectedDate.value))

const confirmMutation = useMutation({
  mutationFn: confirmAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const confirmationSecondaryText = computed(() => {
  if (confirmationModal.value.action === 'cancel') return 'Conservar cita'
  if (confirmationModal.value.action === 'complete') return 'Aún no'
  return 'Cerrar'
})

const completeMutation = useMutation({
  mutationFn: completeAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const cancelMutation = useMutation({
  mutationFn: cancelAppointment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  },
})

const prescriptionMutation = useMutation({
  mutationFn: createPrescription,
  onSuccess: () => {
    prescriptionTarget.value = null
    diagnosis.value = ''
    indications.value = ''
    prescriptionNotes.value = ''
  },
})

const appointments = computed(() => {
  const status = selectedStatus.value

  return [...(appointmentsQuery.data.value ?? [])]
    .filter((appointment) => {
      if (!status) return true
      return normalizeStatus(appointment.status) === status
    })
    .sort((a, b) => {
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    })
})

const completedAppointmentIds = computed(() => {
  return appointments.value
    .filter((appointment) => canPrescribe(appointment))
    .map((appointment) => appointment.id)
})

const prescriptionsByAppointmentQuery = useQuery({
  queryKey: computed(() => [
    'prescriptions',
    'dentist-agenda',
    completedAppointmentIds.value,
  ]),
  queryFn: async () => {
    const entries = await Promise.all(
      completedAppointmentIds.value.map(async (appointmentId) => {
        const prescriptions = await getPrescriptionsByAppointment(appointmentId)
        return [appointmentId, prescriptions] as const
      }),
    )

    return Object.fromEntries(entries) as Record<string, Prescription[]>
  },
  enabled: computed(() => completedAppointmentIds.value.length > 0),
})

const appointmentGroups = computed(() => {
  return groupAppointmentsByDay(appointments.value)
})

const patientIds = computed(() => {
  return [...new Set(appointments.value.map((appointment) => appointment.patientId))]
})

const patientsQuery = useQuery({
  queryKey: computed(() => ['users', 'appointment-patients', patientIds.value]),
  queryFn: async () => {
    const patients = await Promise.all(
      patientIds.value.map((patientId) => getUserByDomainId(patientId)),
    )

    return patients
  },
  enabled: computed(() => patientIds.value.length > 0),
})

const patientNameById = computed(() => {
  return new Map(
    (patientsQuery.data.value ?? []).map((patient) => [
      patient.domainId,
      userDisplayName(patient),
    ]),
  )
})

const confirmationModal = ref<{
  open: boolean
  title: string
  message: string
  confirmText: string
  appointmentId: string | null
  action: 'cancel' | 'complete' | null
}>({
  open: false,
  title: '',
  message: '',
  confirmText: '',
  appointmentId: null,
  action: null,
})

function normalizeStatus(status: string) {
  return status.toUpperCase()
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendientes',
    CONFIRMED: 'Confirmadas',
    CANCELLED: 'Canceladas',
    COMPLETED: 'Completadas',
  }

  return labels[normalizeStatus(status)] ?? status
}

function statusClass(status: string) {
  return `status-${normalizeStatus(status).toLowerCase()}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatAgendaDate(value: string) {
  const date = parseLocalDateValue(value)

  const weekday = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
  }).format(date)

  const day = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
  }).format(date)

  const month = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
  }).format(date)

  return `${weekday} ${day} de ${capitalize(month)}`
}

function formatDay(value: string) {
  return formatAgendaDate(getLocalDateValue(new Date(value)))
}

const statusFilterOptions = [
  { value: '', label: 'Todas' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

function updateStatusFilter(status: string) {
  selectedStatus.value = status

  router.replace({
    query: {
      ...route.query,
      scope: showAllAppointments.value ? 'all' : undefined,
      status: status || undefined,
    },
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeRange(appointment: Appointment) {
  return `${formatTime(appointment.startAt)} - ${formatTime(appointment.endAt)}`
}

function getLocalDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number) {
  const date = parseLocalDateValue(value)
  date.setDate(date.getDate() + days)
  return getLocalDateValue(date)
}

function goToPreviousDate() {
  selectedDate.value = addDays(selectedDate.value, -1)
  showAllAppointments.value = false

  router.replace({
    query: {
      ...route.query,
      scope: undefined,
    },
  })
}

function goToNextDate() {
  selectedDate.value = addDays(selectedDate.value, 1)
  showAllAppointments.value = false

  router.replace({
    query: {
      ...route.query,
      scope: undefined,
    },
  })
}

function handleCalendarChange() {
  showAllAppointments.value = false

  router.replace({
    query: {
      ...route.query,
      scope: undefined,
    },
  })
}

function openCalendar() {
  calendarInputRef.value?.showPicker?.()
  calendarInputRef.value?.click()
}

function toggleShowAllAppointments() {
  showAllAppointments.value = !showAllAppointments.value

  router.replace({
    query: {
      ...route.query,
      scope: showAllAppointments.value ? 'all' : undefined,
    },
  })
}

function groupAppointmentsByDay(appointments: Appointment[]) {
  return appointments.reduce<Array<{ key: string; label: string; appointments: Appointment[] }>>(
    (groups, appointment) => {
      const key = getLocalDateValue(new Date(appointment.startAt))
      const existingGroup = groups.find((group) => group.key === key)

      if (existingGroup) {
        existingGroup.appointments.push(appointment)
      } else {
        groups.push({
          key,
          label: formatDay(appointment.startAt),
          appointments: [appointment],
        })
      }

      return groups
    },
    [],
  )
}

function appointmentCountLabel(count: number) {
  return count === 1 ? '1 cita' : `${count} citas`
}

function patientDisplayName(patientId: string) {
  if (patientsQuery.isLoading.value || patientsQuery.isFetching.value) {
    return 'Cargando paciente...'
  }

  return patientNameById.value.get(patientId) ?? 'Paciente no disponible'
}

function canConfirm(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'PENDING'
}

function canComplete(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'CONFIRMED'
}

function canCompleteNow(appointment: Appointment) {
  return new Date(appointment.startAt).getTime() <= Date.now()
}

function completionBlockedMessage(appointment: Appointment) {
  if (normalizeStatus(appointment.status) !== 'CONFIRMED' || canCompleteNow(appointment)) {
    return ''
  }

  return `Podrás completarla a partir de ${formatTime(appointment.startAt)}.`
}

function canCancel(appointment: Appointment) {
  const status = normalizeStatus(appointment.status)
  return status !== 'CANCELLED' && status !== 'COMPLETED'
}

function canPrescribe(appointment: Appointment) {
  return normalizeStatus(appointment.status) === 'COMPLETED'
}

function prescriptionButtonLabel(appointment: Appointment) {
  const prescriptions =
    prescriptionsByAppointmentQuery.data.value?.[appointment.id]

  if (!prescriptions) {
    return 'Receta'
  }

  return prescriptions.length > 0 ? 'Ver receta' : 'Crear receta'
}

async function handleConfirm(id: string) {
  clearActionError(id)
  actionSuccess.value = ''

  try {
    await confirmMutation.mutateAsync(id)
    actionSuccess.value = 'Cita confirmada correctamente.'
  } catch (error: unknown) {
    setActionError(id, getActionErrorMessage(error))
  }
}

function openCancelConfirmation(appointment: Appointment) {
  clearActionError(appointment.id)
  actionSuccess.value = ''

  if (!canCancel(appointment)) {
    setActionError(appointment.id, 'Solo puedes cancelar citas pendientes o confirmadas.')
    return
  }

  confirmationModal.value = {
    open: true,
    title: 'Cancelar cita',
    message: 'Esta acción cancelará la cita y el paciente verá el cambio en su historial.',
    confirmText: 'Sí, cancelar cita',
    appointmentId: appointment.id,
    action: 'cancel',
  }
}

function openCompleteConfirmation(appointment: Appointment) {
  clearActionError(appointment.id)
  actionSuccess.value = ''

  if (!canComplete(appointment)) {
    setActionError(appointment.id, 'Solo puedes completar citas confirmadas.')
    return
  }

  if (!canCompleteNow(appointment)) {
    return
  }

  confirmationModal.value = {
    open: true,
    title: 'Completar cita',
    message: 'La cita pasará a completada y podrás registrar la receta correspondiente.',
    confirmText: 'Sí, completar cita',
    appointmentId: appointment.id,
    action: 'complete',
  }
}

function closeConfirmationModal() {
  confirmationModal.value = {
    open: false,
    title: '',
    message: '',
    confirmText: '',
    appointmentId: null,
    action: null,
  }
}

async function confirmAppointmentAction() {
  const id = confirmationModal.value.appointmentId
  const action = confirmationModal.value.action

  if (!id || !action) return

  closeConfirmationModal()

  if (action === 'cancel') {
    await handleCancel(id)
    return
  }

  if (action === 'complete') {
    await handleCompleteConfirmed(id)
  }
}

async function handleCompleteConfirmed(id: string) {
  clearActionError(id)
  actionSuccess.value = ''

  try {
    await completeMutation.mutateAsync(id)
    actionSuccess.value = 'Cita marcada como completada.'
  } catch (error: unknown) {
    setActionError(id, getActionErrorMessage(error))
  }
}

async function handleCancel(id: string) {
  clearActionError(id)
  actionSuccess.value = ''

  try {
    await cancelMutation.mutateAsync(id)
    actionSuccess.value = 'Cita cancelada correctamente.'
  } catch (error: unknown) {
    setActionError(id, getActionErrorMessage(error))
  }
}

function setActionError(appointmentId: string, message: string) {
  appointmentActionErrors.value = {
    ...appointmentActionErrors.value,
    [appointmentId]: message,
  }
}

function clearActionError(appointmentId: string) {
  const nextErrors = { ...appointmentActionErrors.value }
  delete nextErrors[appointmentId]
  appointmentActionErrors.value = nextErrors
}

function getActionErrorMessage(error: unknown) {
  return getApiErrorMessage(error)
}

function isBusy() {
  return (
    confirmMutation.isPending.value ||
    completeMutation.isPending.value ||
    cancelMutation.isPending.value
  )
}

async function openPrescription(appointment: Appointment) {
  if (!canPrescribe(appointment)) {
    setActionError(
      appointment.id,
      'Solo se pueden crear recetas para citas completadas.',
    )
    return
  }

  prescriptionTarget.value = appointment
  existingPrescription.value = null
  diagnosis.value = ''
  indications.value = ''
  prescriptionNotes.value = ''
  prescriptionError.value = ''
  isLoadingPrescription.value = true
  prescriptionLookupFailed.value = false

  try {
    const loadedPrescriptions =
      prescriptionsByAppointmentQuery.data.value?.[appointment.id]
    const prescriptions =
      loadedPrescriptions ??
      (await getPrescriptionsByAppointment(appointment.id))
    const prescription = prescriptions[0] ?? null

    existingPrescription.value = prescription

    if (prescription) {
      diagnosis.value = prescription.diagnosis
      indications.value = prescription.indications
      prescriptionNotes.value = prescription.notes ?? ''
    }
  } catch (error: unknown) {
    prescriptionLookupFailed.value = true
    prescriptionError.value = getActionErrorMessage(error)
  } finally {
    isLoadingPrescription.value = false
  }
}

async function submitPrescription() {
  if (
    !prescriptionTarget.value ||
    existingPrescription.value ||
    prescriptionLookupFailed.value
  ) {
    return
  }

  prescriptionError.value = ''

  try {
    await prescriptionMutation.mutateAsync({
      appointmentId: prescriptionTarget.value.id,
      patientId: prescriptionTarget.value.patientId,
      dentistId: prescriptionTarget.value.dentistId,
      diagnosis: diagnosis.value,
      indications: indications.value,
      notes: prescriptionNotes.value || undefined,
    })

    actionSuccess.value = 'Receta guardada correctamente.'
    queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  } catch (error: unknown) {
    prescriptionError.value = getActionErrorMessage(error)
  }
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Odontólogo</p>
        <h2>Mi agenda</h2>
      </div>

      <div class="agenda-date-controls" aria-label="Controles de fecha de agenda">
        <button
          class="date-nav-button"
          type="button"
          aria-label="Día anterior"
          @click="goToPreviousDate"
        >
          ‹
        </button>

        <span class="selected-date-pill">
          {{ showAllAppointments ? 'Todas las citas' : selectedDateLabel }}
        </span>

        <button
          class="date-nav-button"
          type="button"
          aria-label="Día siguiente"
          @click="goToNextDate"
        >
          ›
        </button>

        <button class="secondary-button inline-button" type="button" @click="openCalendar">
          Calendario
        </button>

        <input
          ref="calendarInputRef"
          v-model="selectedDate"
          class="native-date-input"
          type="date"
          aria-label="Seleccionar fecha"
          @change="handleCalendarChange"
        />

        <button class="secondary-button inline-button" type="button" @click="toggleShowAllAppointments">
          {{ showAllAppointments ? 'Ver por fecha' : 'Ver todas' }}
        </button>
      </div>
    </div>

    <p class="helper-text">
      Las solicitudes pendientes no bloquean definitivamente el horario hasta que confirmes una
    </p>

    <div class="agenda-filters">
      <button
        v-for="option in statusFilterOptions"
        :key="option.value || 'all'"
        class="filter-chip"
        :class="{ active: selectedStatus === option.value }"
        type="button"
        @click="updateStatusFilter(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="actionSuccess" class="success-message">
      {{ actionSuccess }}
    </p>

    <p v-if="patientsQuery.isError.value" class="error-message">
      {{ patientsErrorMessage }}
    </p>

    <p v-if="prescriptionsByAppointmentQuery.isError.value" class="error-message">
      {{ prescriptionsErrorMessage }}
    </p>

    <p v-if="appointmentsQuery.isLoading.value || appointmentsQuery.isFetching.value">
      Cargando agenda...
    </p>

    <p v-else-if="appointmentsQuery.isError.value" class="error-message">
      {{ appointmentsErrorMessage }}
    </p>

    <div v-else-if="appointmentGroups.length" class="agenda-board">
      <section
        v-for="group in appointmentGroups"
        :key="group.key"
        class="agenda-day"
      >
        <div class="agenda-day-header">
          <div>
            <p class="eyebrow">Día</p>
            <h3>{{ group.label }}</h3>
          </div>
          <span class="agenda-count">{{ appointmentCountLabel(group.appointments.length) }}</span>
        </div>

        <div class="agenda-list">
          <article
            v-for="appointment in group.appointments"
            :key="appointment.id"
            class="agenda-item"
            :class="statusClass(appointment.status)"
          >
            <div class="agenda-time">
              <strong>{{ formatTime(appointment.startAt) }}</strong>
              <span>{{ formatTime(appointment.endAt) }}</span>
            </div>

            <div class="agenda-card">
              <div class="agenda-card-header">
                <div>
                  <h3>{{ appointment.reason ?? 'Cita odontológica' }}</h3>
                  <p>{{ formatTimeRange(appointment) }}</p>
                </div>

                <span class="status-badge" :class="statusClass(appointment.status)">
                  {{ statusLabel(appointment.status) }}
                </span>

                <span
                  v-if="normalizeStatus(appointment.status) === 'PENDING'"
                  class="request-badge"
                >
                  Solicitud por confirmar
                </span>
              </div>

              <div class="agenda-meta">
                <span>Paciente</span>
                <strong>{{ patientDisplayName(appointment.patientId) }}</strong>
              </div>

              <p v-if="appointment.notes" class="agenda-notes">
                {{ appointment.notes }}
              </p>

              <p
                v-if="completionBlockedMessage(appointment)"
                class="info-message"
              >
                {{ completionBlockedMessage(appointment) }}
              </p>

              <p
                v-if="appointmentActionErrors[appointment.id]"
                class="error-message"
              >
                {{ appointmentActionErrors[appointment.id] }}
              </p>

              <div class="card-actions">
                <button
                  v-if="canConfirm(appointment)"
                  class="primary-button inline-button"
                  type="button"
                  :disabled="isBusy()"
                  @click="handleConfirm(appointment.id)"
                >
                  Confirmar
                </button>

                <button
                  v-if="canComplete(appointment)"
                  class="primary-button inline-button"
                  type="button"
                  :disabled="isBusy() || !canCompleteNow(appointment)"
                  :title="
                    !canCompleteNow(appointment)
                      ? completionBlockedMessage(appointment)
                      : 'Marcar cita como completada'
                  "
                  @click="openCompleteConfirmation(appointment)"
                >
                  Completar
                </button>

                <button
                  v-if="canPrescribe(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  @click="openPrescription(appointment)"
                >
                  {{ prescriptionButtonLabel(appointment) }}
                </button>

                <RouterLink
                  v-if="canPrescribe(appointment) && !appointment.hasPayment"
                  class="primary-button inline-button payment-link"
                  :to="{ path: '/dentist/payments', query: { appointment: appointment.id } }"
                >
                  Registrar pago
                </RouterLink>

                <span
                  v-if="canPrescribe(appointment) && appointment.hasPayment"
                  class="payment-registered-badge"
                >
                  Pago registrado
                </span>

                <button
                  v-if="canCancel(appointment)"
                  class="secondary-button inline-button"
                  type="button"
                  :disabled="isBusy()"
                  @click="openCancelConfirmation(appointment)"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-else class="empty-state">
      {{
        selectedStatus
          ? `No tienes citas ${statusLabel(selectedStatus).toLowerCase()} ${showAllAppointments ? '' : 'para esta fecha'}.`
          : showAllAppointments
            ? 'No tienes citas asignadas.'
            : 'No tienes citas asignadas para esta fecha.'
      }}
    </div>

    <Teleport to="body">
      <div
        v-if="prescriptionTarget"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prescription-modal-title"
      >
        <section class="modal-card prescription-modal-card">
          <header class="modal-header">
            <div>
              <p class="eyebrow">
                {{ existingPrescription ? 'Receta registrada' : 'Nueva receta' }}
              </p>
              <h2 id="prescription-modal-title">
                {{ prescriptionTarget.reason ?? 'Cita odontológica' }}
              </h2>
            </div>
          </header>

          <form class="modal-form" @submit.prevent="submitPrescription">
            <p v-if="isLoadingPrescription">Cargando receta...</p>

            <label>
              Diagnóstico
              <input
                v-model="diagnosis"
                :disabled="isLoadingPrescription"
                :readonly="Boolean(existingPrescription)"
                required
              />
            </label>

            <label>
              Indicaciones
              <textarea
                v-model="indications"
                :disabled="isLoadingPrescription"
                :readonly="Boolean(existingPrescription)"
                rows="3"
                required
              />
            </label>

            <label>
              Notas
              <textarea
                v-model="prescriptionNotes"
                :disabled="isLoadingPrescription"
                :readonly="Boolean(existingPrescription)"
                rows="3"
              />
            </label>

            <p v-if="prescriptionError" class="error-message">
              {{ prescriptionError }}
            </p>

            <div class="modal-actions">
              <button
                class="modal-action-button modal-action-secondary"
                type="button"
                @click="prescriptionTarget = null"
              >
                {{ existingPrescription ? 'Cerrar' : 'Cancelar' }}
              </button>

              <button
                v-if="!existingPrescription && !prescriptionLookupFailed"
                class="modal-action-button modal-action-primary"
                type="submit"
                :disabled="prescriptionMutation.isPending.value || isLoadingPrescription"
              >
                {{ prescriptionMutation.isPending.value ? 'Guardando...' : 'Guardar receta' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

      <ConfirmDialog
        :open="confirmationModal.open"
        :variant="confirmationModal.action === 'cancel' ? 'danger' : 'success'"
        :title="confirmationModal.title"
        :message="confirmationModal.message"
        :confirm-text="confirmationModal.confirmText"
        :cancel-text="confirmationSecondaryText"
        :loading="cancelMutation.isPending.value || completeMutation.isPending.value"
        @confirm="confirmAppointmentAction"
        @cancel="closeConfirmationModal"
      />
  </AppLayout>
</template>

<style scoped>

.agenda-date-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.date-nav-button {
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.date-nav-button:hover {
  border-color: #0f766e;
  color: #0f766e;
}

.selected-date-pill {
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0.55rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #0f172a;
  font-weight: 800;
}

.native-date-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.request-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 0.78rem;
  font-weight: 700;
}

.helper-text {
  margin: -0.5rem 0 1rem;
  color: #64748b;
  font-size: 0.95rem;
}

.agenda-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 1rem 0;
}

.filter-chip {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  border-radius: 999px;
  padding: 0.45rem 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.filter-chip.active {
  border-color: #0f766e;
  background: #e6f7f2;
  color: #0f766e;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgb(15 23 42 / 0.55);
}

.modal-card {
  width: min(100%, 620px);
  border-radius: 24px;
  background: #fff;
  padding: 1.5rem;
  box-shadow: 0 24px 80px rgb(15 23 42 / 0.25);
}

.prescription-modal-card {
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  margin-bottom: 1rem;
}

.modal-form {
  display: grid;
  gap: 1rem;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.modal-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 4rem;
  border-radius: 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.modal-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 4rem;
  border-radius: 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.modal-action-secondary {
  border: 1px solid #d8e2ec;
  background: #fff;
  color: #172033;
}

.modal-action-primary {
  border: 1px solid #0f6b85;
  background: #0f6b85;
  color: #fff;
}

.modal-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.confirmation-dialog .eyebrow {
  margin-bottom: 8px;
}

.success-button:hover {
  background: #15803d;
}

.confirmation-dialog h2 {
  margin: 0;
  color: #111827;
  font-size: 1.8rem;
}

.danger-button:hover {
  background: #b91c1c;
}

.confirmation-actions .secondary-button {
  border-radius: 999px;
  padding: 12px 20px;
}

.info-message {
  margin-top: 8px;
  color: #475569;
  font-weight: 700;
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.payment-link {
  text-decoration: none;
}

.payment-registered-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 0.85rem;
  font-weight: 800;
}
</style>
