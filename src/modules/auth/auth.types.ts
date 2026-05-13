export type UserRole = 'ADMIN' | 'DENTIST' | 'PATIENT'

export interface AuthUser {
  id?: string
  sub?: string
  domainId?: string
  email: string
  fullName?: string
  name?: string
  role: UserRole
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  fullName: string
}

export interface LoginResponse {
  accessToken?: string
  token?: string
  access_token?: string
  user?: AuthUser
}