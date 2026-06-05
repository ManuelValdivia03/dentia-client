import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../app/api'
import { getPrioritizedDentists } from './dentists.service'

vi.mock('../../app/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

describe('dentists.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gets prioritized dentists', async () => {
    const dentists = [
      {
        domainId: 'd1',
        fullName: 'Dra. Demo Dentia',
        previouslyVisited: true,
      },
      {
        domainId: 'd2',
        fullName: 'Dr. Nuevo Dentia',
        previouslyVisited: false,
      },
    ]

    vi.mocked(api.get).mockResolvedValue({ data: dentists })

    const result = await getPrioritizedDentists()

    expect(api.get).toHaveBeenCalledWith('/dentists/prioritized')
    expect(result).toEqual(dentists)
  })
})