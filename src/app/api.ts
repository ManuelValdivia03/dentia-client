import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { router } from './router'

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

const baseURL = import.meta.env.VITE_API_BASE_URL
const sessionIdleTimeoutMs = getEnvNumber(
  import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS,
  5 * 60 * 1000,
)

export const api = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
})

const authApi = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
})

let refreshRequest: Promise<string> | null = null

function extractAccessToken(data: {
  accessToken?: string
  token?: string
  access_token?: string
}) {
  const token = data.accessToken ?? data.token ?? data.access_token

  if (!token) {
    throw new Error('El backend no regreso accessToken')
  }

  return token
}

function getEnvNumber(value: unknown, fallback: number) {
  const parsed = Number(value)

  return value && Number.isFinite(parsed) ? parsed : fallback
}

function isSessionIdle() {
  const lastActivityAt = Number(localStorage.getItem('dentia_last_activity_at'))

  return (
    !lastActivityAt || Date.now() - lastActivityAt >= sessionIdleTimeoutMs
  )
}

function clearStoredSession() {
  localStorage.removeItem('dentia_token')
  localStorage.removeItem('dentia_user')
  localStorage.removeItem('dentia_last_activity_at')
  window.dispatchEvent(new Event('dentia:session-expired'))
}

async function refreshAccessToken() {
  if (isSessionIdle()) {
    throw new Error('Sesion cerrada por inactividad')
  }

  if (!refreshRequest) {
    refreshRequest = authApi
      .post('/auth/refresh')
      .then(({ data }) => {
        const token = extractAccessToken(data)

        localStorage.setItem('dentia_token', token)

        if (data.user) {
          localStorage.setItem('dentia_user', JSON.stringify(data.user))
        }

        window.dispatchEvent(
          new CustomEvent('dentia:session-refreshed', { detail: data }),
        )

        return token
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dentia_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const url = originalRequest?.url ?? ''
    const isAuthSessionEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthSessionEndpoint
    ) {
      originalRequest._retry = true

      try {
        const token = await refreshAccessToken()

        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      } catch {
        clearStoredSession()

        if (router.currentRoute.value.path !== '/login') {
          router.push('/login')
        }
      }
    }

    if (error.response?.status === 401 && !isAuthSessionEndpoint) {
      clearStoredSession()

      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
    }

    return Promise.reject(error)
  },
)

if (typeof window !== 'undefined') {
  window.addEventListener('dentia:session-expired', () => {
    if (router.currentRoute.value.path !== '/login') {
      router.push('/login')
    }
  })
}
