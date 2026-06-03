import { api } from '../../app/api'

export interface UserSummary {
  id?: string
  domainId: string
  fullName?: string
  name?: string
  email?: string
  role?: string
  photoUrl?: string | null
}

export async function getUserByDomainId(domainId: string) {
  const { data } = await api.get<UserSummary>(`/users/${domainId}`)
  return data
}

export function userDisplayName(user?: UserSummary) {
  return user?.fullName ?? user?.name ?? user?.email ?? user?.domainId
}
