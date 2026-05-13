import { api } from '../../app/api'
import type { Dentist } from './dentists.types'

export async function getDentists(): Promise<Dentist[]> {
  const { data } = await api.get<Dentist[]>('/dentists')
  return data
}

export async function getDentistByDomainId(domainId: string): Promise<Dentist> {
  const { data } = await api.get<Dentist>(`/dentists/${domainId}`)
  return data
}