import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../app/api'
import { requestPasswordReset, resetPassword } from './auth.service'

vi.mock('../../app/api', () => ({
  api: {
    post: vi.fn(),
  },
}))

describe('auth.service password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests a password reset code', async () => {
    const response = {
      message:
        'Si el correo existe y esta verificado, enviaremos un codigo de recuperacion.',
    }

    vi.mocked(api.post).mockResolvedValue({ data: response })

    const result = await requestPasswordReset({
      email: 'patient@dentia.local',
    })

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'patient@dentia.local',
    })
    expect(result).toEqual(response)
  })

  it('resets the password with the emailed code', async () => {
    const payload = {
      email: 'patient@dentia.local',
      code: '123456',
      password: 'NewPassword123',
    }
    const response = {
      message: 'Contrasena actualizada correctamente',
    }

    vi.mocked(api.post).mockResolvedValue({ data: response })

    const result = await resetPassword(payload)

    expect(api.post).toHaveBeenCalledWith('/auth/reset-password', payload)
    expect(result).toEqual(response)
  })
})
