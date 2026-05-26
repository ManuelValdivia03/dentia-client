import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dentia_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

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
  patientId: string
  dentistId: string
  startAt: string
  endAt: string
  reason?: string
  notes?: string
}

export async function getAppointments() {
  const { data } = await api.get<Appointment[]>('/appointments')
  return data
}

export async function createAppointment(payload: CreateAppointmentPayload) {
  const { data } = await api.post<Appointment>('/appointments', payload)
  return data
}

export async function cancelAppointment(id: string) {
  const { data } = await api.patch<Appointment>(`/appointments/${id}/cancel`)
  return data
}
