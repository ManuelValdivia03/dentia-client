import { api } from '../../app/api'
import type {
  AuthUser,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
} from './auth.types'

function extractToken(data: LoginResponse): string {
  const token = data.accessToken ?? data.token ?? data.access_token

  if (!token) {
    throw new Error('El backend no regresó un token válido')
  }

  return token
}

export async function login(payload: LoginPayload) {
  const { data } = await api.post<LoginResponse>('/auth/login', payload)
  const token = extractToken(data)

  localStorage.setItem('dentia_token', token)

  const user = data.user ?? (await getProfile())

  return {
    token,
    user,
  }
}

export async function register(payload: RegisterPayload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export async function getProfile(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/profile')
  return data
}