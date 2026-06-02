import { api } from '../../app/api'
import type {
  AuthUser,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  ResendVerificationCodePayload,
  VerifyEmailPayload,
} from './auth.types'

function extractToken(data: LoginResponse): string {
  const token = data.accessToken ?? data.token ?? data.access_token

  if (!token) {
    throw new Error('El backend no regresó accessToken')
  }

  return token
}

export async function login(payload: LoginPayload) {
  const { data } = await api.post<LoginResponse>('/auth/login', payload)

  const token = extractToken(data)
  const user = data.user ?? (await getProfile())

  return {
    token,
    user,
  }
}

export async function register(payload: RegisterPayload) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (value instanceof File) {
      formData.append(key, value)
      continue
    }

    formData.append(key, String(value))
  }

  const { data } = await api.post('/auth/register', formData)
  return data
}

export async function verifyEmail(payload: VerifyEmailPayload) {
  const { data } = await api.post('/auth/verify-email', payload)
  return data
}

export async function resendVerificationCode(
  payload: ResendVerificationCodePayload,
) {
  const { data } = await api.post('/auth/resend-verification-code', payload)
  return data
}

export async function getProfile(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/profile')
  return data
}

export async function refreshSession() {
  const { data } = await api.post<LoginResponse>('/auth/refresh')

  const token = extractToken(data)
  const user = data.user ?? (await getProfile())

  return {
    token,
    user,
  }
}

export async function logoutSession() {
  await api.post('/auth/logout')
}
