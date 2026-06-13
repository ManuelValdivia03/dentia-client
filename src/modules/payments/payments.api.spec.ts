import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../app/api'
import { createPayment, getCashCut } from './payments.api'

vi.mock('../../app/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('payments api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests a cash cut using the selected range', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { paymentCount: 0, totalAmount: 0, byMethod: [], payments: [] },
    })

    await getCashCut('2026-06-01', '2026-06-12')

    expect(api.get).toHaveBeenCalledWith('/payments', {
      params: { from: '2026-06-01', to: '2026-06-12' },
    })
  })

  it('registers the payment against its appointment', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'payment-1' } })

    await createPayment({
      appointmentId: 'appointment-1',
      amount: 850,
      method: 'CARD',
      treatmentDescription: 'Limpieza dental',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/payments/appointments/appointment-1',
      {
        amount: 850,
        method: 'CARD',
        treatmentDescription: 'Limpieza dental',
      },
    )
  })
})
