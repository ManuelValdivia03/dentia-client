import axios from 'axios'

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data

    const message = data?.message ?? data?.error

    if (Array.isArray(message)) {
      return message.join(', ')
    }

    if (typeof message === 'string') {
      return translateBackendMessage(message, status)
    }

    if (status === 400) return 'Los datos enviados no son válidos.'
    if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
    if (status === 403) return 'No tienes permisos para realizar esta acción.'
    if (status === 404) return 'No se encontró la información solicitada.'
    if (status === 409) return 'La operación no se puede completar porque existe un conflicto.'
    if (status === 413) return 'El archivo supera el tamaño máximo permitido.'
    if (status === 415) return 'El tipo de archivo no es compatible.'
    if (status && status >= 500) return 'Ocurrió un error en el servidor. Intenta más tarde.'

    return 'No se pudo completar la operación.'
  }

  if (error instanceof Error) return error.message

  return 'Ocurrió un error inesperado.'
}

function translateBackendMessage(message: string, status?: number): string {
  if (message === 'Patient already has a pending appointment request in this time range') {
    return 'Ya tienes una solicitud pendiente para ese dentista en ese horario.'
  }

  if (message === 'Dentist already has an appointment in this time range') {
    return 'El dentista ya tiene una cita en ese horario. Selecciona otro horario.'
  }

  if (message.includes('startAt must be in the future')) {
    return 'Elige una fecha y hora posteriores al momento actual.'
  }

  if (message === 'startAt must be before endAt') {
    return 'La hora de inicio debe ser anterior a la hora de fin.'
  }

  if (message.includes('Only pending or confirmed appointments can be cancelled')) {
    return 'Solo puedes cancelar citas pendientes o confirmadas.'
  }

  if (message.includes('Only pending or confirmed appointments can be rescheduled')) {
    return 'Solo puedes reprogramar citas pendientes o confirmadas.'
  }

  if (message.includes('Patient can only access own appointments')) {
    return 'No tienes permisos para modificar esta cita.'
  }

  if (message === 'Appointment cannot be completed before its start time') {
    return 'Todavía no puedes completar esta cita porque aún no llega su fecha y hora.'
  }

  if (message.includes('Only pending appointments can be confirmed')) {
    return 'Solo puedes confirmar citas pendientes.'
  }

  if (message.includes('Only confirmed appointments can be completed')) {
    return 'Solo puedes completar citas confirmadas.'
  }

  if (message.includes('Only pending or confirmed appointments can be cancelled')) {
    return 'Solo puedes cancelar citas pendientes o confirmadas.'
  }

  if (message.includes('Prescription already exists for this appointment')) { 
    return 'Esta cita ya tiene una receta registrada.'
  }

  if (message.includes('Only completed appointments can have prescriptions')) {
    return 'Solo puedes crear recetas para citas completadas.'
  }

  if (status === 409) {
    return 'La operación no se puede completar porque existe un conflicto.'
  }

  return message
}