export type RangePreset = 'today' | 'week' | 'month' | 'year' | 'custom'

export interface PaymentRange {
  from: string
  to: string
}

export interface PeriodOption extends PaymentRange {
  value: string
  label: string
}

export interface AvailablePaymentPeriods {
  today: PeriodOption[]
  week: PeriodOption[]
  month: PeriodOption[]
  year: PeriodOption[]
}

export function rangeForPreset(
  preset: Exclude<RangePreset, 'custom'>,
  anchor: Date,
): PaymentRange {
  const start = startOfDay(anchor)
  const end = startOfDay(anchor)

  if (preset === 'week') {
    start.setDate(start.getDate() - start.getDay())
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 6)
  }

  if (preset === 'month') {
    start.setDate(1)
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0)
  }

  if (preset === 'year') {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  }

  return {
    from: localDate(start),
    to: localDate(end),
  }
}

export function buildAvailablePeriods(dates: string[]): AvailablePaymentPeriods {
  const uniqueDates = [...new Set(dates)].sort()
  const days = uniqueDates.map((date) => ({
    value: date,
    label: formatDay(date),
    from: date,
    to: date,
  }))

  const weekRanges = uniqueRangeMap(uniqueDates, 'week')
  const monthRanges = uniqueRangeMap(uniqueDates, 'month')
  const yearRanges = uniqueRangeMap(uniqueDates, 'year')

  const weeks = [...weekRanges.values()]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((range, index) => ({
      ...range,
      value: range.from,
      label: `Semana ${index + 1} · ${formatShortRange(range)}`,
    }))

  const months = [...monthRanges.values()].map((range) => ({
    ...range,
    value: range.from,
    label: capitalize(
      new Intl.DateTimeFormat('es-MX', {
        month: 'long',
        year: 'numeric',
      }).format(parseLocalDate(range.from)),
    ),
  }))

  const years = [...yearRanges.values()].map((range) => ({
    ...range,
    value: range.from,
    label: range.from.slice(0, 4),
  }))

  return {
    today: days.reverse(),
    week: weeks.reverse(),
    month: months.sort((a, b) => b.from.localeCompare(a.from)),
    year: years.sort((a, b) => b.from.localeCompare(a.from)),
  }
}

export function isValidRange(range: PaymentRange) {
  return Boolean(range.from && range.to && range.from <= range.to)
}

export function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function uniqueRangeMap(
  dates: string[],
  preset: 'week' | 'month' | 'year',
) {
  const ranges = new Map<string, PaymentRange>()

  for (const date of dates) {
    const range = rangeForPreset(preset, parseLocalDate(date))
    ranges.set(range.from, range)
  }

  return ranges
}

function formatDay(value: string) {
  return capitalize(
    new Intl.DateTimeFormat('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parseLocalDate(value)),
  )
}

function formatShortRange(range: PaymentRange) {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${formatter.format(parseLocalDate(range.from))} a ${formatter.format(parseLocalDate(range.to))}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
