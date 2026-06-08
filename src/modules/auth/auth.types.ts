export type UserRole = 'ADMIN' | 'DENTIST' | 'PATIENT'

export interface AuthUser {
  id?: string
  sub?: string
  domainId?: string
  email: string
  fullName?: string
  name?: string
  role: UserRole
  specialty?: string
  cedulaProfesional?: string
  escuela?: string
  descripcion?: string
  photoUrl?: string | null
  emailVerified?: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  fullName: string
  role?: 'PATIENT' | 'DENTIST'
  specialty?: string
  cedulaProfesional?: string
  escuela?: string
  descripcion?: string
  photo?: File | null
}

export interface UpdateProfilePayload {
  fullName?: string
  specialty?: string
  escuela?: string
  descripcion?: string
  photo?: File | null
}

export interface VerifyEmailPayload {
  email: string
  code: string
}

export interface ResendVerificationCodePayload {
  email: string
}

export interface RequestPasswordResetPayload {
  email: string
}

export interface ResetPasswordPayload {
  email: string
  code: string
  password: string
}

export interface AuthMessageResponse {
  message: string
}

export interface LoginResponse {
  accessToken?: string
  token?: string
  access_token?: string
  user?: AuthUser
}
