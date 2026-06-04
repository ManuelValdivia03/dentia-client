import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import DentistAgendaPage from './DentistAgendaPage.vue'

const mocks = vi.hoisted(() => ({
  getDentistDayAgenda: vi.fn(),
  getAppointments: vi.fn(),
  createAppointment: vi.fn(),
  getAvailability: vi.fn(),
  confirmAppointment: vi.fn(),
  completeAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  createPrescription: vi.fn(),
  getUserByDomainId: vi.fn(),
}))

vi.mock('../modules/appointments/appointments.api', () => ({
  getDentistDayAgenda: mocks.getDentistDayAgenda,
  getAppointments: mocks.getAppointments,
  createAppointment: mocks.createAppointment,
  getAvailability: mocks.getAvailability,
  confirmAppointment: mocks.confirmAppointment,
  completeAppointment: mocks.completeAppointment,
  cancelAppointment: mocks.cancelAppointment,
}))

vi.mock('../modules/prescriptions/prescriptions.api', () => ({
  createPrescription: mocks.createPrescription,
}))

vi.mock('../modules/users/users.api', () => ({
  getUserByDomainId: mocks.getUserByDomainId,
  userDisplayName: (user: { fullName?: string; email?: string }) =>
    user.fullName ?? user.email ?? 'Paciente',
}))

function mountPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return mount(DentistAgendaPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        AppLayout: {
          template: '<div><slot /></div>',
        },
        RouterLink: true,
        RouterView: true,
      },
    },
  })
}

describe('DentistAgendaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getUserByDomainId.mockResolvedValue({
      domainId: 'p1',
      fullName: 'Paciente Uno',
      email: 'paciente@dentia.local',
    })
  })

  it('loads appointments using dentist day agenda endpoint', async () => {
    mocks.getDentistDayAgenda.mockResolvedValue([
      {
        id: 'appointment-1',
        patientId: 'p1',
        dentistId: 'd1',
        reason: 'Consulta general',
        notes: '',
        startAt: '2026-06-04T15:00:00.000Z',
        endAt: '2026-06-04T16:00:00.000Z',
        status: 'CONFIRMED',
      },
    ])

    const wrapper = mountPage()
    await flushPromises()

    expect(mocks.getDentistDayAgenda).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Consulta general')
    expect(wrapper.text()).toContain('Confirmada')
  })

  it('shows prescription button only for completed appointments', async () => {
    mocks.getDentistDayAgenda.mockResolvedValue([
      {
        id: 'appointment-1',
        patientId: 'p1',
        dentistId: 'd1',
        reason: 'Cita completada',
        notes: '',
        startAt: '2026-06-04T15:00:00.000Z',
        endAt: '2026-06-04T16:00:00.000Z',
        status: 'COMPLETED',
      },
    ])

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Receta')
  })

  it('does not show prescription button for non completed appointments', async () => {
    mocks.getDentistDayAgenda.mockResolvedValue([
      {
        id: 'appointment-1',
        patientId: 'p1',
        dentistId: 'd1',
        reason: 'Cita pendiente',
        notes: '',
        startAt: '2026-06-04T15:00:00.000Z',
        endAt: '2026-06-04T16:00:00.000Z',
        status: 'PENDING',
      },
    ])

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Receta')
  })
})