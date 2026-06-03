import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getProfile,
  login as loginRequest,
  logoutSession as logoutRequest,
  refreshSession as refreshSessionRequest,
  register as registerRequest,
  resendVerificationCode as resendVerificationCodeRequest,
  updateProfile as updateProfileRequest,
  verifyEmail as verifyEmailRequest,
} from '../modules/auth/auth.service'
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ResendVerificationCodePayload,
  UpdateProfilePayload,
  VerifyEmailPayload,
} from '../modules/auth/auth.types'

function isJwtExpired(token: string): boolean {
  const expiresAt = getJwtExpiration(token)

  return !expiresAt || expiresAt <= Date.now()
}

function getJwtExpiration(token: string): number | null {
  try {
    const payloadBase64 = token.split('.')[1]
    const payload = JSON.parse(atob(payloadBase64))

    if (!payload.exp) return null

    return payload.exp * 1000
  } catch {
    return null
  }
}

function getEnvNumber(value: unknown, fallback: number) {
  const parsed = Number(value)

  return value && Number.isFinite(parsed) ? parsed : fallback
}

export const useAuthStore = defineStore('auth', () => {
  const idleTimeoutMs = getEnvNumber(
    import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS,
    5 * 60 * 1000,
  )

  const token = ref<string | null>(localStorage.getItem('dentia_token'))

  const storedUser = localStorage.getItem('dentia_user')
  const user = ref<AuthUser | null>(storedUser ? JSON.parse(storedUser) : null)

  let idleTimer: number | undefined
  let refreshTimer: number | undefined
  let listenersInstalled = false
  let lastActivityAt =
    Number(localStorage.getItem('dentia_last_activity_at')) || Date.now()
  let activitySinceLastRefresh = false
  let refreshInFlight: Promise<boolean> | null = null

  const isAuthenticated = computed(() => {
    if (!token.value) return false

    return !isJwtExpired(token.value)
  })

  const role = computed(() => user.value?.role ?? null)

  async function login(payload: LoginPayload) {
    const result = await loginRequest(payload)

    applySession(result.token, result.user)
    setLastActivity(Date.now())
    activitySinceLastRefresh = false
    startSessionMonitoring()
  }

  async function register(payload: RegisterPayload) {
    return registerRequest(payload)
  }

  async function verifyEmail(payload: VerifyEmailPayload) {
    return verifyEmailRequest(payload)
  }

  async function resendVerificationCode(
    payload: ResendVerificationCodePayload,
  ) {
    return resendVerificationCodeRequest(payload)
  }

  async function loadProfile() {
    const authenticated = await ensureAuthenticated()

    if (!authenticated) {
      return
    }

    const profile = await getProfile()
    user.value = profile

    localStorage.setItem('dentia_user', JSON.stringify(profile))
  }

  async function updateProfile(payload: UpdateProfilePayload) {
    const profile = await updateProfileRequest(payload)
    user.value = profile
    localStorage.setItem('dentia_user', JSON.stringify(profile))
    return profile
  }

  async function ensureAuthenticated() {
    if (!token.value) {
      return false
    }

    if (!isJwtExpired(token.value)) {
      startSessionMonitoring()
      return true
    }

    return refreshSession()
  }

  async function refreshSession() {
    if (refreshInFlight) {
      return refreshInFlight
    }

    refreshInFlight = refreshSessionRequest()
      .then((result) => {
        applySession(result.token, result.user)
        activitySinceLastRefresh = false
        startSessionMonitoring()
        return true
      })
      .catch(() => {
        clearSession()
        return false
      })
      .finally(() => {
        refreshInFlight = null
      })

    return refreshInFlight
  }

  function applySession(nextToken: string, nextUser: AuthUser) {
    token.value = nextToken
    user.value = nextUser

    localStorage.setItem('dentia_token', nextToken)
    localStorage.setItem('dentia_user', JSON.stringify(nextUser))
  }

  function clearSession() {
    token.value = null
    user.value = null

    localStorage.removeItem('dentia_token')
    localStorage.removeItem('dentia_user')
    localStorage.removeItem('dentia_last_activity_at')

    clearSessionTimers()
  }

  function logout() {
    const hadSession = Boolean(token.value)

    clearSession()

    if (hadSession) {
      void logoutRequest().catch(() => undefined)
    }
  }

  function startSessionMonitoring() {
    if (typeof window === 'undefined' || !token.value) {
      return
    }

    if (Date.now() - lastActivityAt >= idleTimeoutMs) {
      logout()
      window.dispatchEvent(new Event('dentia:session-expired'))
      return
    }

    installSessionListeners()
    scheduleIdleLogout()
    scheduleTokenRefresh()
  }

  function installSessionListeners() {
    if (listenersInstalled) {
      return
    }

    const activityEvents = [
      'click',
      'keydown',
      'mousedown',
      'mousemove',
      'scroll',
      'touchstart',
    ]

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true })
    }

    window.addEventListener('dentia:session-expired', () => {
      clearSession()
    })

    window.addEventListener('dentia:session-refreshed', (event) => {
      const detail = (event as CustomEvent).detail
      const nextToken =
        detail?.accessToken ?? detail?.token ?? detail?.access_token

      if (nextToken && detail?.user) {
        applySession(nextToken, detail.user)
        activitySinceLastRefresh = false
        startSessionMonitoring()
      }
    })

    listenersInstalled = true
  }

  function recordActivity() {
    if (!token.value) {
      return
    }

    const now = Date.now()

    if (now - lastActivityAt < 1000) {
      return
    }

    setLastActivity(now)
    activitySinceLastRefresh = true
    scheduleIdleLogout()

    if (isJwtExpired(token.value)) {
      void refreshSession()
    }
  }

  function scheduleIdleLogout() {
    if (typeof window === 'undefined') {
      return
    }

    window.clearTimeout(idleTimer)

    idleTimer = window.setTimeout(() => {
      const idleFor = Date.now() - lastActivityAt

      if (idleFor >= idleTimeoutMs) {
        logout()
        window.dispatchEvent(new Event('dentia:session-expired'))
        return
      }

      scheduleIdleLogout()
    }, idleTimeoutMs)
  }

  function scheduleTokenRefresh() {
    if (typeof window === 'undefined' || !token.value) {
      return
    }

    window.clearTimeout(refreshTimer)

    const expiresAt = getJwtExpiration(token.value) ?? Date.now()
    const refreshAt = expiresAt - 30 * 1000
    const delay = Math.max(refreshAt - Date.now(), 15 * 1000)

    refreshTimer = window.setTimeout(async () => {
      if (!token.value || Date.now() - lastActivityAt >= idleTimeoutMs) {
        return
      }

      if (activitySinceLastRefresh) {
        await refreshSession()
        return
      }

      scheduleTokenRefresh()
    }, delay)
  }

  function clearSessionTimers() {
    if (typeof window === 'undefined') {
      return
    }

    window.clearTimeout(idleTimer)
    window.clearTimeout(refreshTimer)
  }

  function setLastActivity(value: number) {
    lastActivityAt = value
    localStorage.setItem('dentia_last_activity_at', String(value))
  }

  installSessionListeners()

  if (token.value) {
    startSessionMonitoring()
  }

  return {
    token,
    user,
    role,
    isAuthenticated,
    login,
    register,
    verifyEmail,
    resendVerificationCode,
    loadProfile,
    updateProfile,
    ensureAuthenticated,
    refreshSession,
    logout,
  }
})
