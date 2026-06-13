<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import {
  getAppointments,
  type Appointment,
} from '../modules/appointments/appointments.api'
import {
  createPayment,
  getCashCut,
  type PaymentMethod,
} from '../modules/payments/payments.api'
import {
  getUserByDomainId,
  userDisplayName,
} from '../modules/users/users.api'
import { getApiErrorMessage } from '../utils/api-error'

type RangePreset = 'today' | 'week' | 'month' | 'year' | 'custom'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const today = localDate(new Date())
const selectedPreset = ref<RangePreset>('today')
const from = ref(today)
const to = ref(today)
const paymentTarget = ref<Appointment | null>(null)
const amount = ref<number | null>(null)
const method = ref<PaymentMethod>('CASH')
const treatmentDescription = ref('')
const notes = ref('')
const paidAt = ref(localDateTime(new Date()))
const formError = ref('')
const successMessage = ref('')

const cashCutQuery = useQuery({
  queryKey: computed(() => ['payments', 'cash-cut', from.value, to.value]),
  queryFn: () => getCashCut(from.value, to.value),
})

const appointmentsQuery = useQuery({
  queryKey: ['appointments', 'payments'],
  queryFn: getAppointments,
})

const appointments = computed(() => appointmentsQuery.data.value ?? [])
const payments = computed(() => cashCutQuery.data.value?.payments ?? [])
const completedWithoutPayment = computed(() =>
  appointments.value
    .filter(
      (appointment) =>
        appointment.status.toUpperCase() === 'COMPLETED' &&
        !appointment.hasPayment,
    )
    .sort(
      (a, b) =>
        new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    ),
)

const patientIds = computed(() => [
  ...new Set([
    ...payments.value.map((payment) => payment.patientId),
    ...completedWithoutPayment.value.map((appointment) => appointment.patientId),
  ]),
])

const patientsQuery = useQuery({
  queryKey: computed(() => ['users', 'payment-patients', patientIds.value]),
  queryFn: () => Promise.all(patientIds.value.map(getUserByDomainId)),
  enabled: computed(() => patientIds.value.length > 0),
})

const patientNames = computed(
  () =>
    new Map(
      (patientsQuery.data.value ?? []).map((patient) => [
        patient.domainId,
        userDisplayName(patient),
      ]),
    ),
)

const createMutation = useMutation({
  mutationFn: createPayment,
  onSuccess: async () => {
    closePaymentModal()
    successMessage.value = 'Pago registrado correctamente.'
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    ])
  },
})

watch(
  () => route.query.appointment,
  (appointmentId) => {
    if (typeof appointmentId !== 'string') return
    const appointment = appointments.value.find(
      (item) => item.id === appointmentId && !item.hasPayment,
    )
    if (appointment) openPaymentModal(appointment)
  },
)

watch(
  appointments,
  () => {
    const appointmentId = route.query.appointment
    if (typeof appointmentId !== 'string' || paymentTarget.value) return
    const appointment = appointments.value.find(
      (item) => item.id === appointmentId && !item.hasPayment,
    )
    if (appointment) openPaymentModal(appointment)
  },
  { immediate: true },
)

function selectPreset(preset: RangePreset) {
  selectedPreset.value = preset
  if (preset === 'custom') return

  const end = new Date()
  const start = new Date()

  if (preset === 'week') start.setDate(end.getDate() - 6)
  if (preset === 'month') start.setMonth(end.getMonth() - 1)
  if (preset === 'year') start.setFullYear(end.getFullYear() - 1)

  from.value = localDate(start)
  to.value = localDate(end)
}

function openPaymentModal(appointment?: Appointment) {
  paymentTarget.value = appointment ?? completedWithoutPayment.value[0] ?? null
  amount.value = null
  method.value = 'CASH'
  treatmentDescription.value = paymentTarget.value?.reason?.trim() ?? ''
  notes.value = ''
  paidAt.value = localDateTime(new Date())
  formError.value = ''
  successMessage.value = ''
}

function closePaymentModal() {
  paymentTarget.value = null
  formError.value = ''
  if (route.query.appointment) {
    router.replace({ query: { ...route.query, appointment: undefined } })
  }
}

async function submitPayment() {
  if (!paymentTarget.value || !amount.value || amount.value <= 0) {
    formError.value = 'Ingresa un monto mayor a cero.'
    return
  }

  if (!treatmentDescription.value.trim()) {
    formError.value = 'Indica qué tratamiento o servicio se realizó.'
    return
  }

  formError.value = ''

  try {
    await createMutation.mutateAsync({
      appointmentId: paymentTarget.value.id,
      amount: amount.value,
      method: method.value,
      treatmentDescription: treatmentDescription.value.trim(),
      notes: notes.value.trim() || undefined,
      paidAt: paidAt.value || undefined,
    })
  } catch (error: unknown) {
    formError.value = getApiErrorMessage(error)
  }
}

function patientName(patientId: string) {
  return patientNames.value.get(patientId) ?? 'Paciente'
}

function methodLabel(value: string) {
  const labels: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    OTHER: 'Otro',
  }
  return labels[value] ?? value
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function appointmentLabel(appointment: Appointment) {
  return `${formatDateTime(appointment.startAt)} · ${patientName(appointment.patientId)} · ${appointment.reason || 'Cita odontológica'}`
}

function exportCsv() {
  const rows = [
    ['fecha_pago', 'paciente', 'cita', 'metodo', 'realizado', 'monto', 'notas'],
    ...payments.value.map((payment) => [
      formatDateTime(payment.paidAt),
      patientName(payment.patientId),
      payment.appointmentReason,
      methodLabel(payment.method),
      payment.treatmentDescription,
      payment.amount.toFixed(2),
      payment.notes ?? '',
    ]),
    [],
    ['CORTE DE CAJA'],
    ['desde', from.value],
    ['hasta', to.value],
    ['operaciones', String(cashCutQuery.data.value?.paymentCount ?? 0)],
    ['total', String(cashCutQuery.data.value?.totalAmount ?? 0)],
  ]
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dentia-corte-${from.value}-${to.value}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${localDate(date)}T${hours}:${minutes}`
}
</script>

<template>
  <AppLayout>
    <div class="payments-page">
      <header class="payments-header">
        <div>
          <p class="eyebrow">Administración financiera</p>
          <h2>Pagos y cortes de caja</h2>
          <p class="payments-subtitle">
            Registra cada cobro y consulta ingresos de cualquier periodo.
          </p>
        </div>

        <div class="header-actions">
          <button
            class="secondary-button inline-button"
            type="button"
            :disabled="payments.length === 0"
            @click="exportCsv"
          >
            Descargar reporte
          </button>
          <button
            class="primary-button inline-button"
            type="button"
            :disabled="completedWithoutPayment.length === 0"
            @click="openPaymentModal()"
          >
            Registrar pago
          </button>
        </div>
      </header>

      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

      <section class="range-panel">
        <div class="preset-buttons" aria-label="Periodo del corte">
          <button
            v-for="preset in [
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: '7 días' },
              { value: 'month', label: 'Mes' },
              { value: 'year', label: 'Año' },
              { value: 'custom', label: 'Personalizado' },
            ]"
            :key="preset.value"
            class="range-chip"
            :class="{ active: selectedPreset === preset.value }"
            type="button"
            @click="selectPreset(preset.value as RangePreset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="date-fields">
          <label>
            Desde
            <input v-model="from" type="date" @change="selectedPreset = 'custom'" />
          </label>
          <label>
            Hasta
            <input v-model="to" type="date" @change="selectedPreset = 'custom'" />
          </label>
        </div>
      </section>

      <p v-if="cashCutQuery.isLoading.value">Calculando corte de caja...</p>
      <p v-else-if="cashCutQuery.isError.value" class="error-message">
        {{ getApiErrorMessage(cashCutQuery.error.value) }}
      </p>

      <template v-else>
        <section class="summary-grid">
          <article class="summary-card total-card">
            <span>Total del periodo</span>
            <strong>{{ formatMoney(cashCutQuery.data.value?.totalAmount ?? 0) }}</strong>
            <small>{{ cashCutQuery.data.value?.paymentCount ?? 0 }} pagos registrados</small>
          </article>

          <article
            v-for="item in cashCutQuery.data.value?.byMethod ?? []"
            :key="item.method"
            class="summary-card"
          >
            <span>{{ methodLabel(item.method) }}</span>
            <strong>{{ formatMoney(item.total) }}</strong>
            <small>{{ item.count }} operaciones</small>
          </article>
        </section>

        <section class="payments-list-section">
          <div class="section-title">
            <div>
              <p class="eyebrow">Movimientos</p>
              <h3>Pagos registrados</h3>
            </div>
            <span class="pending-badge">
              {{ completedWithoutPayment.length }} citas pendientes de cobro
            </span>
          </div>

          <div v-if="payments.length" class="payments-table-wrap">
            <table class="payments-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Servicio realizado</th>
                  <th>Método</th>
                  <th class="money-cell">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="payment in payments" :key="payment.id">
                  <td>{{ formatDateTime(payment.paidAt) }}</td>
                  <td>
                    <strong>{{ patientName(payment.patientId) }}</strong>
                    <small>{{ payment.appointmentReason }}</small>
                  </td>
                  <td>
                    {{ payment.treatmentDescription }}
                    <small v-if="payment.notes">{{ payment.notes }}</small>
                  </td>
                  <td><span class="method-pill">{{ methodLabel(payment.method) }}</span></td>
                  <td class="money-cell"><strong>{{ formatMoney(payment.amount) }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty-state">
            No hay pagos registrados en este periodo.
          </div>
        </section>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="paymentTarget"
        class="payment-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        @click.self="closePaymentModal"
      >
        <section class="payment-modal">
          <div>
            <p class="eyebrow">Nuevo movimiento</p>
            <h2 id="payment-modal-title">Registrar pago</h2>
          </div>

          <form class="payment-form" @submit.prevent="submitPayment">
            <label>
              Cita completada
              <select v-model="paymentTarget" required>
                <option
                  v-for="appointment in completedWithoutPayment"
                  :key="appointment.id"
                  :value="appointment"
                >
                  {{ appointmentLabel(appointment) }}
                </option>
              </select>
            </label>

            <div class="form-row">
              <label>
                Monto
                <input
                  v-model.number="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="$0.00"
                  required
                />
              </label>
              <label>
                Método de pago
                <select v-model="method" required>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro</option>
                </select>
              </label>
            </div>

            <label>
              Fecha y hora del pago
              <input v-model="paidAt" type="datetime-local" :max="localDateTime(new Date())" required />
            </label>

            <label>
              ¿Qué se realizó?
              <textarea
                v-model="treatmentDescription"
                rows="3"
                maxlength="500"
                placeholder="Ej. Limpieza dental y aplicación de flúor"
                required
              />
            </label>

            <label>
              Notas opcionales
              <textarea
                v-model="notes"
                rows="2"
                maxlength="1000"
                placeholder="Referencia, parcialidad u observaciones"
              />
            </label>

            <p v-if="formError" class="error-message">{{ formError }}</p>

            <div class="modal-actions">
              <button class="secondary-button" type="button" @click="closePaymentModal">
                Cancelar
              </button>
              <button
                class="primary-button"
                type="submit"
                :disabled="createMutation.isPending.value"
              >
                {{ createMutation.isPending.value ? 'Guardando...' : 'Registrar pago' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
.payments-page { display: grid; gap: 1.25rem; }
.payments-header, .section-title, .header-actions, .date-fields, .form-row, .modal-actions {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}
.payments-header { align-items: flex-end; }
.payments-header h2, .section-title h3, .payment-modal h2 { margin: 0.25rem 0 0; }
.payments-subtitle { margin: 0.4rem 0 0; color: #64748b; }
.range-panel { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid #dbe5ed; border-radius: 20px; background: #fff; }
.preset-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.range-chip { border: 1px solid #cbd5e1; border-radius: 999px; padding: 0.55rem 0.9rem; background: #fff; color: #334155; font-weight: 800; cursor: pointer; }
.range-chip.active { border-color: #0f766e; background: #e6f7f2; color: #0f766e; }
.date-fields label, .payment-form label { display: grid; gap: 0.4rem; color: #334155; font-size: 0.85rem; font-weight: 800; }
.date-fields input { min-height: 2.7rem; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
.summary-card { display: grid; gap: 0.35rem; padding: 1.15rem; border: 1px solid #dbe5ed; border-radius: 20px; background: #fff; }
.summary-card span, .summary-card small { color: #64748b; }
.summary-card strong { color: #0f172a; font-size: 1.5rem; }
.total-card { border-color: #99d8c9; background: linear-gradient(135deg, #ecfdf5, #fff); }
.payments-list-section { padding: 1.25rem; border: 1px solid #dbe5ed; border-radius: 22px; background: #fff; }
.pending-badge, .method-pill { display: inline-flex; border-radius: 999px; padding: 0.4rem 0.7rem; background: #f1f5f9; color: #475569; font-size: 0.78rem; font-weight: 800; }
.payments-table-wrap { margin-top: 1rem; overflow-x: auto; }
.payments-table { width: 100%; border-collapse: collapse; }
.payments-table th, .payments-table td { padding: 0.9rem 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
.payments-table th { color: #64748b; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
.payments-table td small { display: block; margin-top: 0.2rem; color: #64748b; }
.payments-table .money-cell { text-align: right; white-space: nowrap; }
.payment-modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1rem; background: rgb(15 23 42 / 0.58); backdrop-filter: blur(8px); }
.payment-modal { width: min(100%, 680px); max-height: 94vh; overflow-y: auto; padding: 1.5rem; border-radius: 24px; background: #fff; box-shadow: 0 24px 80px rgb(15 23 42 / 0.3); }
.payment-form { display: grid; gap: 1rem; margin-top: 1.25rem; }
.payment-form input, .payment-form select, .payment-form textarea { width: 100%; box-sizing: border-box; }
.form-row > label { flex: 1; }
.modal-actions > button { flex: 1; min-height: 3.5rem; }
@media (max-width: 760px) {
  .payments-header, .range-panel, .section-title, .form-row { align-items: stretch; flex-direction: column; }
  .header-actions, .date-fields { width: 100%; }
  .header-actions > button, .date-fields > label { flex: 1; }
}
</style>
