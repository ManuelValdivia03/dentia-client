import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import DentistAgendaPage from './DentistAgendaPage.vue'

const mocks = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  routeQuery: {} as Record<string, string>,
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

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()

  return {
    ...actual,
    useRoute: () => ({
      query: mocks.routeQuery,
    }),
    useRouter: () => ({
      replace: mocks.routerReplace,
    }),
  }
})

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

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(text))

  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }

  return button
}

describe('DentistAgendaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.routeQuery = {}

    mocks.getUserByDomainId.mockResolvedValue({
      domainId: 'p1',
      fullName: 'Paciente Uno',
      email: 'paciente@dentia.local',
    })

    mocks.getDentistDayAgenda.mockResolvedValue([])
  })

  it('shows multiple pending requests for the same time slot', async () => {
    mocks.getDentistDayAgenda.mockResolvedValue([
      {
        id: 'appointment-1',
        patientId: 'p1',
        dentistId: 'd1',
        reason: 'Consulta paciente uno',
        notes: '',
        startAt: '2026-06-04T15:00:00.000Z',
        endAt: '2026-06-04T16:00:00.000Z',
        status: 'PENDING',
      },
      {
        id: 'appointment-2',
        patientId: 'p2',
        dentistId: 'd1',
        reason: 'Consulta paciente dos',
        notes: '',
        startAt: '2026-06-04T15:00:00.000Z',
        endAt: '2026-06-04T16:00:00.000Z',
        status: 'PENDING',
      },
    ])

    mocks.getUserByDomainId
      .mockResolvedValueOnce({
        domainId: 'p1',
        fullName: 'Paciente Uno',
        email: 'p1@dentia.local',
      })
      .mockResolvedValueOnce({
        domainId: 'p2',
        fullName: 'Paciente Dos',
        email: 'p2@dentia.local',
      })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Consulta paciente uno')
    expect(wrapper.text()).toContain('Consulta paciente dos')
    expect(wrapper.text()).toContain('Paciente Uno')
    expect(wrapper.text()).toContain('Paciente Dos')
    expect(wrapper.text()).toContain('Pendiente')
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

it('confirms pending appointment request', async () => {
  mocks.getDentistDayAgenda.mockResolvedValue([
    {
      id: 'appointment-1',
      patientId: 'p1',
      dentistId: 'd1',
      reason: 'Consulta pendiente',
      notes: '',
      startAt: '2026-06-04T15:00:00.000Z',
      endAt: '2026-06-04T16:00:00.000Z',
      status: 'PENDING',
    },
  ])

  mocks.confirmAppointment.mockResolvedValue({
    id: 'appointment-1',
    patientId: 'p1',
    dentistId: 'd1',
    reason: 'Consulta pendiente',
    notes: '',
    startAt: '2026-06-04T15:00:00.000Z',
    endAt: '2026-06-04T16:00:00.000Z',
    status: 'CONFIRMED',
  })

  const wrapper = mountPage()
  await flushPromises()

  expect(wrapper.text()).toContain('Consulta pendiente')
  expect(wrapper.text()).toContain('Pendiente')

  await findButtonByText(wrapper, 'Confirmar').trigger('click')
  await flushPromises()

  expect(mocks.confirmAppointment).toHaveBeenCalledTimes(1)
})

it('shows cancelled appointments after competing requests are cancelled', async () => {
  mocks.getDentistDayAgenda.mockResolvedValue([
    {
      id: 'appointment-1',
      patientId: 'p1',
      dentistId: 'd1',
      reason: 'Solicitud aceptada',
      notes: '',
      startAt: '2026-06-04T15:00:00.000Z',
      endAt: '2026-06-04T16:00:00.000Z',
      status: 'CONFIRMED',
    },
    {
      id: 'appointment-2',
      patientId: 'p2',
      dentistId: 'd1',
      reason: 'Solicitud cancelada automáticamente',
      notes: '',
      startAt: '2026-06-04T15:00:00.000Z',
      endAt: '2026-06-04T16:00:00.000Z',
      status: 'CANCELLED',
    },
  ])

  mocks.getUserByDomainId
    .mockResolvedValueOnce({
      domainId: 'p1',
      fullName: 'Paciente Uno',
      email: 'p1@dentia.local',
    })
    .mockResolvedValueOnce({
      domainId: 'p2',
      fullName: 'Paciente Dos',
      email: 'p2@dentia.local',
    })

  const wrapper = mountPage()
  await flushPromises()

  expect(wrapper.text()).toContain('Solicitud aceptada')
  expect(wrapper.text()).toContain('Confirmada')
  expect(wrapper.text()).toContain('Solicitud cancelada automáticamente')
  expect(wrapper.text()).toContain('Cancelada')
})

it('does not show raw patient id while patient name is unavailable', async () => {
  mocks.getDentistDayAgenda.mockResolvedValue([
    {
      id: 'appointment-1',
      patientId: 'p-raw-id',
      dentistId: 'd1',
      reason: 'Consulta pendiente',
      notes: '',
      startAt: '2026-06-04T15:00:00.000Z',
      endAt: '2026-06-04T16:00:00.000Z',
      status: 'PENDING',
    },
  ])

  mocks.getUserByDomainId.mockRejectedValue(new Error('not found'))

  const wrapper = mountPage()
  await flushPromises()

  expect(wrapper.text()).not.toContain('p-raw-id')
  expect(wrapper.text()).toContain('Paciente no disponible')
})