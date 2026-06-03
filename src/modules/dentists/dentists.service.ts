import { api } from '../../app/api'
import type { Dentist } from './dentists.types'

export interface DentistRatingsSummary {
  dentistId?: string
  averageScore?: number
  average?: number
  totalRatings?: number
  total?: number
  ratingsCount?: number
}

export async function getDentists(): Promise<Dentist[]> {
  const { data } = await api.get<Dentist[]>('/dentists')
  return data
}

export async function getDentistByDomainId(domainId: string): Promise<Dentist> {
  const { data } = await api.get<Dentist>(`/dentists/${domainId}`)
  return data
}

export async function getDentistRatingsSummary(
  dentistId: string,
): Promise<DentistRatingsSummary> {
  const { data } = await api.get<DentistRatingsSummary>(
    `/dentists/${dentistId}/ratings/summary`,
  )
  return data
}
