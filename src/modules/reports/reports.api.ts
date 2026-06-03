import { api } from '../../app/api'

export interface DashboardSummary {
  total_appointments: number
  scheduled: number
  confirmed: number
  completed: number
  cancelled: number
  no_show: number
  completion_rate: number
}

export interface AppointmentStatusReportItem {
  status: string
  total: number
}

export interface AppointmentStatusReport {
  data: AppointmentStatusReportItem[]
}

export async function getDashboardSummary(doctorId?: string) {
  const { data } = await api.get<DashboardSummary>('/reports/dashboard/summary', {
    params: doctorId ? { doctor_id: doctorId } : undefined,
  })

  return data
}

export async function getAppointmentsByStatus(doctorId?: string) {
  const { data } = await api.get<AppointmentStatusReport>(
    '/reports/appointments/by-status',
    {
      params: doctorId ? { doctor_id: doctorId } : undefined,
    },
  )

  return data
}

export async function exportAppointmentsByStatus(doctorId?: string) {
  const { data } = await api.get<Blob>('/reports/export/appointments-by-status', {
    params: doctorId ? { doctor_id: doctorId } : undefined,
    responseType: 'blob',
  })

  return data
}
