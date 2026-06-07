export const CLINIC_TIME_ZONE =
  import.meta.env.VITE_APPOINTMENTS_TIME_ZONE || 'America/Mexico_City'

export function localDateTimeValue(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue}:00.000`
}

export function addMinutesToLocalDateTime(
  dateValue: string,
  timeValue: string,
  minutesToAdd: number,
) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)

  let totalMinutes = hour * 60 + minute + minutesToAdd
  let dayOffset = Math.floor(totalMinutes / 1440)

  totalMinutes %= 1440

  if (totalMinutes < 0) {
    totalMinutes += 1440
    dayOffset -= 1
  }

  const resultDate = new Date(Date.UTC(year, month - 1, day))
  resultDate.setUTCDate(resultDate.getUTCDate() + dayOffset)

  const resultDateValue = [
    resultDate.getUTCFullYear(),
    String(resultDate.getUTCMonth() + 1).padStart(2, '0'),
    String(resultDate.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const resultHour = Math.floor(totalMinutes / 60)
  const resultMinute = totalMinutes % 60

  return `${resultDateValue}T${String(resultHour).padStart(2, '0')}:${String(
    resultMinute,
  ).padStart(2, '0')}:00.000`
}

export function datePartFromDateTime(value: string) {
  return value.split('T')[0] ?? ''
}

export function timePartFromDateTime(value: string) {
  const time = value.includes('T') ? value.split('T')[1] : value
  return (time ?? '').slice(0, 5)
}

export function getClinicNowKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export function clinicDateTimeKey(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue}`
}

export function isFutureClinicDateTime(dateValue: string, timeValue: string) {
  return clinicDateTimeKey(dateValue, timeValue) > getClinicNowKey()
}

export function normalizeClosedHour(value?: string | null) {
  if (!value) return ''

  const time = timePartFromDateTime(value)

  if (!/^\d{2}:\d{2}$/.test(time)) return ''

  const [hour, minute] = time.split(':').map(Number)

  if (minute !== 0) return ''

  return `${String(hour).padStart(2, '0')}:00`
}
