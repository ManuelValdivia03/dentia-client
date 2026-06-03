import { api } from '../../app/api'

export interface Prescription {
  id: string
  appointmentId: string
  patientId: string
  dentistId: string
  diagnosis: string
  indications: string
  notes?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreatePrescriptionPayload {
  appointmentId: string
  patientId: string
  dentistId: string
  diagnosis: string
  indications: string
  notes?: string
}

export async function createPrescription(payload: CreatePrescriptionPayload) {
  const { data } = await api.post<Prescription>('/prescriptions', payload)
  return data
}

export async function getPrescription(id: string) {
  const { data } = await api.get<Prescription>(`/prescriptions/${id}`)
  return data
}

export async function getPrescriptionsByAppointment(appointmentId: string) {
  const { data } = await api.get<Prescription[]>(
    `/appointments/${appointmentId}/prescriptions`,
  )
  return data
}

export async function downloadPrescriptionPdf(id: string) {
  const { data } = await api.get<Blob>(`/prescriptions/${id}/pdf`, {
    responseType: 'blob',
  })

  return data
}
