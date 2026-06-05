import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import PatientDentistsPage from './PatientDentistsPage.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  getPrioritizedDentists: vi.fn(),
  getDentistRatingsSummary: vi.fn(),
  getAppointments: vi.fn(),
  getAppointmentAvailability: vi.fn(),
  createAppointment: vi.fn(),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()

  return {
    ...actual,
    useRouter: () => ({
      push: mocks.routerPush,
    }),
  }
})

vi.mock('../modules/dentists/dentists.service', () => ({
  getPrioritizedDentists: mocks.getPrioritizedDentists,
  getDentistRatingsSummary: mocks.getDentistRatingsSummary,
}))

vi.mock('../modules/appointments/appointments.api', () => ({
  getAppointments: mocks.getAppointments,
  getAppointmentAvailability: mocks.getAppointmentAvailability,
  createAppointment: mocks.createAppointment,
}))

function mountPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return mount(PatientDentistsPage, {
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

function findButton(wrapper: VueWrapper, text: string) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(text))

  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }

  return button
}

const dentists = [
  {
    domainId: 'd1',
    fullName: 'Dra. Demo Dentia',
    specialty: 'Odontología general',
    descripcion: 'Disponible para consulta.',
    previouslyVisited: true,
  },
  {
    domainId: 'd2',
    fullName: 'Dr. Nuevo Dentia',
    specialty: 'Ortodoncia',
    descripcion: 'Especialista en ortodoncia.',
    previouslyVisited: false,
  },
]

describe('PatientDentistsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getPrioritizedDentists.mockResolvedValue(dentists)
    mocks.getDentistRatingsSummary.mockResolvedValue({
      averageScore: 0,
      totalRatings: 0,
    })
    mocks.getAppointmentAvailability.mockResolvedValue({
      slots: [
        {
          startAt: '2026-06-09T09:00:00',
          endAt: '2026-06-09T10:00:00',
          available: true,
        },
        {
          startAt: '2026-06-09T10:00:00',
          endAt: '2026-06-09T11:00:00',
          available: false,
        },
        {
          startAt: '2026-06-09T11:00:00',
          endAt: '2026-06-09T12:00:00',
          available: true,
        },
      ],
    })
  })

  it('shows previously visited dentist as primary card', async () => {
    mocks.getAppointments.mockResolvedValue([
      {
        id: 'a1',
        patientId: 'p1',
        dentistId: 'd1',
        startAt: '2026-06-08T15:00:00',
        endAt: '2026-06-08T16:00:00',
        status: 'CONFIRMED',
      },
    ])

    const wrapper = mountPage()
    await flushPromises()

    expect(mocks.getPrioritizedDentists).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Tu dentista')
    expect(wrapper.text()).toContain('Dra. Demo Dentia')
    expect(wrapper.text()).toContain('Ya te atendió')
    expect(wrapper.text()).not.toContain('Dr. Nuevo Dentia')
  })

  it('shows the rest of dentists when patient chooses to change dentist', async () => {
    mocks.getAppointments.mockResolvedValue([
      {
        id: 'a1',
        patientId: 'p1',
        dentistId: 'd1',
        startAt: '2026-06-08T15:00:00',
        endAt: '2026-06-08T16:00:00',
        status: 'CONFIRMED',
      },
    ])

    const wrapper = mountPage()
    await flushPromises()

    await findButton(wrapper, 'Cambiar dentista').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Dr. Nuevo Dentia')
  })

  it('does not render unavailable slots returned by availability endpoint', async () => {
    mocks.getAppointments.mockResolvedValue([])

    const wrapper = mountPage()
    await flushPromises()

    await findButton(wrapper, 'Agendar cita').trigger('click')
    await flushPromises()

    await wrapper.get('input[type="date"]').setValue('2026-06-09')
    await flushPromises()

    const options = wrapper.findAll('option').map((option) => option.text())

    expect(options).toContain('09:00')
    expect(options).toContain('11:00')
    expect(options).not.toContain('10:00')
  })

  it('shows conflict message when slot becomes unavailable', async () => {
    mocks.getAppointments.mockResolvedValue([])
    mocks.createAppointment.mockRejectedValue({
      response: {
        status: 409,
        data: {
          message: 'Dentist already has an appointment in this time range',
        },
      },
    })

    const wrapper = mountPage()
    await flushPromises()

    await findButton(wrapper, 'Agendar cita').trigger('click')
    await flushPromises()

    await wrapper.get('input[type="date"]').setValue('2026-06-09')
    await flushPromises()

    await wrapper.get('select').setValue('09:00')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain(
      'El dentista ya tiene una cita en ese horario. Selecciona otro horario.',
    )
  })
})