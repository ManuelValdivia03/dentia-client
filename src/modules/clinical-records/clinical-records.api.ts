import { api } from '../../app/api'
import type {
  ClinicalRecord,
  CreateClinicalEncounterPayload,
  UpdateClinicalRecordPayload,
} from './clinical-records.types'

export async function getMyClinicalRecord(dentistId?: string) {
  const { data } = await api.get<ClinicalRecord>('/clinical-records/me', {
    params: dentistId ? { dentistId } : undefined,
  })

  return data
}

export async function getPatientClinicalRecord(
  patientId: string,
  dentistId?: string,
) {
  const { data } = await api.get<ClinicalRecord>(
    `/clinical-records/patients/${patientId}`,
    {
      params: dentistId ? { dentistId } : undefined,
    },
  )

  return data
}

export async function updatePatientClinicalRecord(
  patientId: string,
  payload: UpdateClinicalRecordPayload,
) {
  const { data } = await api.patch<ClinicalRecord>(
    `/clinical-records/patients/${patientId}`,
    payload,
  )

  return data
}

export async function createClinicalEncounter(
  patientId: string,
  payload: CreateClinicalEncounterPayload,
) {
  const { data } = await api.post(
    `/clinical-records/patients/${patientId}/encounters`,
    payload,
  )

  return data
}