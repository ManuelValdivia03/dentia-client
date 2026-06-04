import { api } from '../../app/api'

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | string

export interface Appointment {
  id: string
  patientId: string
  dentistId: string
  startAt: string
  endAt: string
  reason?: string
  notes?: string
  status: AppointmentStatus
}

export interface CreateAppointmentPayload {
  patientId?: string
  dentistId: string
  startAt: string
  endAt: string
  reason?: string
  notes?: string
}

export interface RescheduleAppointmentPayload {
  id: string
  startAt: string
  endAt: string
  reason?: string
  notes?: string
}

export interface AppointmentAvailabilitySlot {
  startAt?: string
  endAt?: string
  available?: boolean
  label?: string
}

export interface CreateRatingPayload {
  appointmentId: string
  score: number
  comment?: string
}

export async function getAppointments() {
  const { data } = await api.get<Appointment[]>('/appointments')
  return data
}

export async function getAppointment(id: string) {
  const { data } = await api.get<Appointment>(`/appointments/${id}`)
  return data
}

export async function getAppointmentAvailability(
  dentistId: string,
  date: string,
) {
  const { data } = await api.get<AppointmentAvailabilitySlot[] | unknown>(
    '/appointments/availability',
    {
      params: { dentistId, date },
    },
  )

  return data
}

export async function getDentistDayAgenda(date: string) {
  const { data } = await api.get('/appointments/day', {
    params: { date },
  });

  return data;
}

export async function createAppointment(payload: CreateAppointmentPayload) {
  const { data } = await api.post<Appointment>('/appointments', payload)
  return data
}

export async function rescheduleAppointment({
  id,
  startAt,
  endAt,
  reason,
  notes,
}: RescheduleAppointmentPayload) {
  const { data } = await api.patch<Appointment>(
    `/appointments/${id}/reschedule`,
    { startAt, endAt, reason, notes },
  )
  return data
}

export async function cancelAppointment(id: string) {
  const { data } = await api.patch<Appointment>(`/appointments/${id}/cancel`)
  return data
}

export async function confirmAppointment(id: string) {
  const { data } = await api.patch<Appointment>(`/appointments/${id}/confirm`)
  return data
}

export async function completeAppointment(id: string) {
  const { data } = await api.patch<Appointment>(`/appointments/${id}/complete`)
  return data
}

export async function rateAppointment({
  appointmentId,
  score,
  comment,
}: CreateRatingPayload) {
  const { data } = await api.post(`/appointments/${appointmentId}/rating`, {
    score,
    comment,
  })
  return data
}
