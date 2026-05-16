import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getProfile,
  login as loginRequest,
  register as registerRequest,
  resendVerificationCode as resendVerificationCodeRequest,
  verifyEmail as verifyEmailRequest,
} from '../modules/auth/auth.service'
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ResendVerificationCodePayload,
  VerifyEmailPayload,
} from '../modules/auth/auth.types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('dentia_token'))

  const storedUser = localStorage.getItem('dentia_user')
  const user = ref<AuthUser | null>(storedUser ? JSON.parse(storedUser) : null)

  const isAuthenticated = computed(() => Boolean(token.value))
  const role = computed(() => user.value?.role ?? null)

  async function login(payload: LoginPayload) {
    const result = await loginRequest(payload)

    token.value = result.token
    user.value = result.user

    localStorage.setItem('dentia_token', result.token)
    localStorage.setItem('dentia_user', JSON.stringify(result.user))
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
    if (!token.value) return

    const profile = await getProfile()
    user.value = profile

    localStorage.setItem('dentia_user', JSON.stringify(profile))
  }

  function logout() {
    token.value = null
    user.value = null

    localStorage.removeItem('dentia_token')
    localStorage.removeItem('dentia_user')
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
    logout,
  }
})