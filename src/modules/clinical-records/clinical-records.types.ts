export interface ClinicalEncounter {
  id: string
  recordId: string
  patientId: string
  dentistId: string
  appointmentId?: string | null
  reasonForVisit: string
  arrivalDescription?: string | null
  symptoms?: string | null
  diagnosis: string
  treatmentPerformed?: string | null
  treatmentPlan?: string | null
  observations?: string | null
  prescriptionId?: string | null
  fileIds?: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ClinicalRecord {
  id: string
  patientId: string
  bloodType?: string | null
  allergies?: string | null
  chronicDiseases?: string | null
  currentMedications?: string | null
  surgicalHistory?: string | null
  familyHistory?: string | null
  dentalHistory?: string | null
  riskNotes?: string | null
  encounters: ClinicalEncounter[]
  createdAt: string
  updatedAt: string
}

export interface UpdateClinicalRecordPayload {
  bloodType?: string
  allergies?: string
  chronicDiseases?: string
  currentMedications?: string
  surgicalHistory?: string
  familyHistory?: string
  dentalHistory?: string
  riskNotes?: string
}

export interface CreateClinicalEncounterPayload {
  appointmentId: string
  reasonForVisit: string
  arrivalDescription?: string
  symptoms?: string
  diagnosis: string
  treatmentPerformed?: string
  treatmentPlan?: string
  observations?: string
  prescriptionId?: string
  fileIds?: string[]
}