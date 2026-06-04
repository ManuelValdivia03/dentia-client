import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../app/api'
import { getDentistDayAgenda } from './appointments.api'

vi.mock('../../app/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

describe('appointments.api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls dentist day agenda endpoint with selected date', async () => {
    const appointments = [
      {
        id: 'appointment-1',
        patientId: 'p1',
        dentistId: 'd1',
        startAt: '2026-06-04T15:00:00.000Z',
        endAt: '2026-06-04T16:00:00.000Z',
        status: 'CONFIRMED',
      },
    ]

    vi.mocked(api.get).mockResolvedValue({ data: appointments })

    const result = await getDentistDayAgenda('2026-06-04')

    expect(api.get).toHaveBeenCalledWith('/appointments/day', {
      params: { date: '2026-06-04' },
    })
    expect(result).toEqual(appointments)
  })
})