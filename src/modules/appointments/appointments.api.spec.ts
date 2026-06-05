import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../app/api'
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  getAppointmentAvailability,
  getDentistDayAgenda,
} from './appointments.api'

vi.mock('../../app/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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

  it('calls availability endpoint with dentist and date', async () => {
    const availability = {
      dentistId: 'd1',
      date: '2026-06-09',
      slots: [
        {
          startAt: '2026-06-09T09:00:00',
          endAt: '2026-06-09T10:00:00',
          available: true,
        },
      ],
    }

    vi.mocked(api.get).mockResolvedValue({ data: availability })

    const result = await getAppointmentAvailability('d1', '2026-06-09')

    expect(api.get).toHaveBeenCalledWith('/appointments/availability', {
      params: {
        dentistId: 'd1',
        date: '2026-06-09',
      },
    })
    expect(result).toEqual(availability)
  })

  it('creates appointment request', async () => {
    const payload = {
      dentistId: 'd1',
      startAt: '2026-06-09T09:00:00.000Z',
      endAt: '2026-06-09T10:00:00.000Z',
      reason: 'Consulta',
    }

    const appointment = {
      id: 'a1',
      patientId: 'p1',
      ...payload,
      status: 'PENDING',
    }

    vi.mocked(api.post).mockResolvedValue({ data: appointment })

    const result = await createAppointment(payload)

    expect(api.post).toHaveBeenCalledWith('/appointments', payload)
    expect(result).toEqual(appointment)
  })

  it('confirms appointment', async () => {
    const appointment = {
      id: 'a1',
      patientId: 'p1',
      dentistId: 'd1',
      startAt: '2026-06-09T09:00:00.000Z',
      endAt: '2026-06-09T10:00:00.000Z',
      status: 'CONFIRMED',
    }

    vi.mocked(api.patch).mockResolvedValue({ data: appointment })

    const result = await confirmAppointment('a1')

    expect(api.patch).toHaveBeenCalledWith('/appointments/a1/confirm')
    expect(result).toEqual(appointment)
  })

  it('cancels appointment', async () => {
    const appointment = {
      id: 'a1',
      patientId: 'p1',
      dentistId: 'd1',
      startAt: '2026-06-09T09:00:00.000Z',
      endAt: '2026-06-09T10:00:00.000Z',
      status: 'CANCELLED',
    }

    vi.mocked(api.patch).mockResolvedValue({ data: appointment })

    const result = await cancelAppointment('a1')

    expect(api.patch).toHaveBeenCalledWith('/appointments/a1/cancel')
    expect(result).toEqual(appointment)
  })

  it('completes appointment', async () => {
    const appointment = {
      id: 'a1',
      patientId: 'p1',
      dentistId: 'd1',
      startAt: '2026-06-09T09:00:00.000Z',
      endAt: '2026-06-09T10:00:00.000Z',
      status: 'COMPLETED',
    }

    vi.mocked(api.patch).mockResolvedValue({ data: appointment })

    const result = await completeAppointment('a1')

    expect(api.patch).toHaveBeenCalledWith('/appointments/a1/complete')
    expect(result).toEqual(appointment)
  })
})