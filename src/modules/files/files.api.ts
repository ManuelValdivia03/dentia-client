import { api } from '../../app/api'

export interface ClinicalFile {
  id?: string
  _id?: string
  originalName: string
  storedName?: string
  mimeType: string
  size: number
  patientId: string
  appointmentId?: string
  prescriptionId?: string
  uploadedBy?: string
  uploadedByRole?: string
  createdAt?: string
  updatedAt?: string
}

export interface ListFilesParams {
  patientId?: string
  appointmentId?: string
  prescriptionId?: string
}

export interface UploadClinicalFilePayload extends ListFilesParams {
  file: File
}

export async function getFiles(params?: ListFilesParams) {
  const { data } = await api.get<ClinicalFile[]>('/files', { params })
  return data
}

export async function getFile(id: string) {
  const { data } = await api.get<ClinicalFile>(`/files/${id}`)
  return data
}

export async function uploadClinicalFile(payload: UploadClinicalFilePayload) {
  const formData = new FormData()
  formData.append('file', payload.file)

  for (const key of ['patientId', 'appointmentId', 'prescriptionId'] as const) {
    if (payload[key]) {
      formData.append(key, payload[key])
    }
  }

  const { data } = await api.post<ClinicalFile>('/files', formData)
  return data
}

export async function downloadClinicalFile(id: string) {
  const { data } = await api.get<Blob>(`/files/${id}/download`, {
    responseType: 'blob',
  })
  return data
}

export async function deleteClinicalFile(id: string) {
  const { data } = await api.delete(`/files/${id}`)
  return data
}
