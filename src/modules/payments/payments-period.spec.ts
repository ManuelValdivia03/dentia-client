import { describe, expect, it } from 'vitest'
import { buildAvailablePeriods, rangeForPreset } from './payments-period'

describe('payment report periods', () => {
  const june13 = new Date(2026, 5, 13)

  it('uses Sunday through Saturday for a weekly cut', () => {
    expect(rangeForPreset('week', june13)).toEqual({
      from: '2026-06-07',
      to: '2026-06-13',
    })
  })

  it('uses the full calendar month', () => {
    expect(rangeForPreset('month', june13)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('uses the full calendar year', () => {
    expect(rangeForPreset('year', june13)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  it('builds only periods containing payment dates', () => {
    const periods = buildAvailablePeriods([
      '2026-05-30',
      '2026-06-08',
      '2026-06-13',
    ])

    expect(periods.today).toHaveLength(3)
    expect(periods.week).toHaveLength(2)
    expect(periods.week[0]).toMatchObject({
      label: expect.stringContaining('Semana 2'),
      from: '2026-06-07',
      to: '2026-06-13',
    })
    expect(periods.month.map((item) => item.from)).toEqual([
      '2026-06-01',
      '2026-05-01',
    ])
    expect(periods.year).toHaveLength(1)
  })
})
