import { api } from '../../app/api'

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'

export interface AppointmentPayment {
  id: string
  appointmentId: string
  patientId: string
  dentistId: string
  amount: number
  method: PaymentMethod
  treatmentDescription: string
  notes?: string
  paidAt: string
  appointmentStartAt: string
  appointmentReason: string
}

export interface PaymentMethodSummary {
  method: PaymentMethod
  count: number
  total: number
}

export interface CashCut {
  from: string
  to: string
  paymentCount: number
  totalAmount: number
  byMethod: PaymentMethodSummary[]
  payments: AppointmentPayment[]
}

export interface PaymentPeriods {
  dates: string[]
}

export interface CreatePaymentPayload {
  appointmentId: string
  amount: number
  method: PaymentMethod
  treatmentDescription: string
  notes?: string
}

export async function getCashCut(from: string, to: string) {
  const { data } = await api.get<CashCut>('/payments', {
    params: { from, to },
  })

  return data
}

export async function getPaymentPeriods() {
  const { data } = await api.get<PaymentPeriods>('/payments/periods')
  return data
}

export async function createPayment({
  appointmentId,
  ...payload
}: CreatePaymentPayload) {
  const { data } = await api.post<AppointmentPayment>(
    `/payments/appointments/${appointmentId}`,
    payload,
  )

  return data
}
