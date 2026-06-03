<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'
import {
  getAppointments,
  type Appointment,
} from '../modules/appointments/appointments.api'
import {
  createConversation,
  getConversations,
  getMessages,
  markConversationAsRead,
  sendMessage,
  type Conversation,
} from '../modules/chat/chat.api'
import { getDentists } from '../modules/dentists/dentists.service'
import type { Dentist } from '../modules/dentists/dentists.types'
import {
  getUserByDomainId,
  userDisplayName,
  type UserSummary,
} from '../modules/users/users.api'

const authStore = useAuthStore()
const queryClient = useQueryClient()

const selectedConversation = ref<Conversation | null>(null)
const patientId = ref(authStore.role === 'PATIENT' ? authStore.user?.domainId ?? '' : '')
const dentistId = ref(authStore.role === 'DENTIST' ? authStore.user?.domainId ?? '' : '')
const messageBody = ref('')
const messageFile = ref<File | null>(null)
const messageError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const allowedAttachmentTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
]
const maxAttachmentSize = 50 * 1024 * 1024
const attachmentAccept = allowedAttachmentTypes.join(',')

const conversationsQuery = useQuery({
  queryKey: ['chat', 'conversations'],
  queryFn: getConversations,
  refetchInterval: 15000,
})

const appointmentsQuery = useQuery({
  queryKey: ['appointments'],
  queryFn: getAppointments,
})

const dentistsQuery = useQuery({
  queryKey: ['dentists'],
  queryFn: getDentists,
})

const relationshipAppointments = computed(() => {
  return (appointmentsQuery.data.value ?? []).filter((appointment) =>
    hasChatRelation(appointment),
  )
})

const allowedDentistIds = computed(() => [
  ...new Set(relationshipAppointments.value.map((appointment) => appointment.dentistId)),
])

const allowedPatientIds = computed(() => [
  ...new Set(relationshipAppointments.value.map((appointment) => appointment.patientId)),
])

const dentistOptions = computed(() => {
  const dentists = dentistsQuery.data.value ?? []

  if (authStore.role === 'PATIENT') {
    return dentists.filter((dentist) => allowedDentistIds.value.includes(dentist.domainId))
  }

  return dentists
})

const conversationPatientIds = computed(() => [
  ...new Set((conversationsQuery.data.value ?? []).map((conversation) => conversation.patientId)),
])

const patientLookupIds = computed(() => [
  ...new Set([...allowedPatientIds.value, ...conversationPatientIds.value]),
])

const patientsQuery = useQuery({
  queryKey: ['users', 'chat-patients', patientLookupIds],
  queryFn: async () => {
    const users = await Promise.all(
      patientLookupIds.value.map(async (id) => {
        try {
          return await getUserByDomainId(id)
        } catch {
          return { domainId: id } as UserSummary
        }
      }),
    )

    return users
  },
  enabled: computed(() => patientLookupIds.value.length > 0),
})

const patientOptions = computed(() => {
  const patients = patientsQuery.data.value ?? []

  if (authStore.role === 'DENTIST') {
    return patients.filter((patient) => allowedPatientIds.value.includes(patient.domainId))
  }

  return patients
})

const patientNameById = computed(() => {
  return new Map(
    (patientsQuery.data.value ?? []).map((patient) => [
      patient.domainId,
      userDisplayName(patient),
    ]),
  )
})

const dentistNameById = computed(() => {
  return new Map(
    (dentistsQuery.data.value ?? []).map((dentist) => [
      dentist.domainId,
      dentistName(dentist),
    ]),
  )
})

const selectedConversationId = computed(() => {
  return selectedConversation.value?.id ?? selectedConversation.value?._id ?? ''
})

const messagesQuery = useQuery({
  queryKey: ['chat', 'messages', selectedConversationId],
  queryFn: () => getMessages(selectedConversationId.value),
  enabled: computed(() => Boolean(selectedConversationId.value)),
  refetchInterval: 8000,
})

const canCreateConversation = computed(() => {
  if (authStore.role === 'PATIENT') {
    return Boolean(authStore.user?.domainId && dentistId.value)
  }

  if (authStore.role === 'DENTIST') {
    return Boolean(patientId.value && authStore.user?.domainId)
  }

  return Boolean(patientId.value && dentistId.value)
})

const createConversationMutation = useMutation({
  mutationFn: createConversation,
  onSuccess: (conversation) => {
    selectedConversation.value = conversation
    queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
  },
})

const sendMessageMutation = useMutation({
  mutationFn: sendMessage,
  onSuccess: () => {
    messageBody.value = ''
    messageFile.value = null
    messageError.value = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    queryClient.invalidateQueries({ queryKey: ['chat'] })
  },
})

watch(dentistOptions, (options) => {
  if (authStore.role !== 'PATIENT') return

  if (!options.some((dentist) => dentist.domainId === dentistId.value)) {
    dentistId.value = options[0]?.domainId ?? ''
  }
}, { immediate: true })

watch(patientOptions, (options) => {
  if (authStore.role !== 'DENTIST') return

  if (!options.some((patient) => patient.domainId === patientId.value)) {
    patientId.value = options[0]?.domainId ?? ''
  }
}, { immediate: true })

function hasChatRelation(appointment: Appointment) {
  const status = appointment.status.toUpperCase()
  return status === 'CONFIRMED' || status === 'COMPLETED'
}

function dentistName(dentist: Dentist) {
  return dentist.fullName ?? dentist.name ?? dentist.email ?? dentist.domainId
}

function conversationId(conversation: Conversation) {
  return conversation.id ?? conversation._id ?? ''
}

function patientDisplayName(id: string) {
  if (id === authStore.user?.domainId) {
    return authStore.user.fullName ?? authStore.user.name ?? authStore.user.email ?? id
  }

  return patientNameById.value.get(id) ?? id
}

function dentistDisplayName(id: string) {
  if (id === authStore.user?.domainId) {
    return authStore.user.fullName ?? authStore.user.name ?? authStore.user.email ?? id
  }

  return dentistNameById.value.get(id) ?? id
}

function conversationTitle(conversation: Conversation) {
  if (authStore.role === 'PATIENT') {
    return dentistDisplayName(conversation.dentistId)
  }

  if (authStore.role === 'DENTIST') {
    return patientDisplayName(conversation.patientId)
  }

  return `${patientDisplayName(conversation.patientId)} · ${dentistDisplayName(conversation.dentistId)}`
}

function messageSenderName(senderId: string) {
  if (senderId === authStore.user?.domainId) {
    return 'Tú'
  }

  return patientNameById.value.get(senderId) ?? dentistNameById.value.get(senderId) ?? senderId
}

function attachmentLabel(message: { attachment?: { originalName?: string } | null }) {
  return message.attachment?.originalName ?? 'Archivo adjunto'
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    return response?.data?.message ?? 'No se pudo enviar el archivo.'
  }

  return 'No se pudo enviar el mensaje.'
}

function formatDate(value?: string) {
  if (!value) return ''

  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function selectConversation(conversation: Conversation) {
  selectedConversation.value = conversation
  const id = conversationId(conversation)

  if (id) {
    await markConversationAsRead(id).catch(() => undefined)
  }
}

async function submitConversation() {
  const currentPatientId =
    authStore.role === 'PATIENT' ? authStore.user?.domainId : patientId.value
  const currentDentistId =
    authStore.role === 'DENTIST' ? authStore.user?.domainId : dentistId.value

  if (!currentPatientId || !currentDentistId) return

  await createConversationMutation.mutateAsync({
    patientId: currentPatientId,
    dentistId: currentDentistId,
  })
}

function onMessageFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  messageError.value = ''

  if (!file) {
    messageFile.value = null
    return
  }

  if (!allowedAttachmentTypes.includes(file.type)) {
    messageFile.value = null
    input.value = ''
    messageError.value = 'Solo puedes enviar imagenes, videos o PDF.'
    return
  }

  if (file.size > maxAttachmentSize) {
    messageFile.value = null
    input.value = ''
    messageError.value = 'El archivo debe pesar 50 MB o menos.'
    return
  }

  messageFile.value = file
}

async function submitMessage() {
  if (!selectedConversationId.value || (!messageBody.value && !messageFile.value)) {
    return
  }

  messageError.value = ''

  try {
    await sendMessageMutation.mutateAsync({
      conversationId: selectedConversationId.value,
      body: messageBody.value || undefined,
      file: messageFile.value,
    })
  } catch (error) {
    messageError.value = getErrorMessage(error)
  }
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">Mensajería clínica</p>
        <h2>Chat</h2>
      </div>
    </div>

    <div class="chat-grid">
      <section class="card">
        <h3>Conversaciones</h3>

        <form class="stacked-form" @submit.prevent="submitConversation">
          <label v-if="authStore.role !== 'PATIENT'">
            Paciente
            <select v-model="patientId" required>
              <option value="">Selecciona un paciente</option>
              <option
                v-for="patient in patientOptions"
                :key="patient.domainId"
                :value="patient.domainId"
              >
                {{ userDisplayName(patient) }}
              </option>
            </select>
          </label>

          <label v-if="authStore.role !== 'DENTIST'">
            Dentista
            <select v-model="dentistId" required>
              <option value="">Selecciona un dentista</option>
              <option
                v-for="dentist in dentistOptions"
                :key="dentist.domainId"
                :value="dentist.domainId"
              >
                {{ dentistName(dentist) }}
              </option>
            </select>
          </label>

          <p
            v-if="authStore.role === 'PATIENT' && !dentistOptions.length"
            class="muted-text"
          >
            Podrás iniciar chat cuando tengas una cita confirmada o completada.
          </p>

          <p
            v-if="authStore.role === 'DENTIST' && !patientOptions.length"
            class="muted-text"
          >
            Podrás iniciar chat con pacientes que tengan una cita confirmada o completada.
          </p>

          <button
            class="primary-button"
            type="submit"
            :disabled="createConversationMutation.isPending.value || !canCreateConversation"
          >
            Crear conversación
          </button>
        </form>

        <div v-if="conversationsQuery.data.value?.length" class="list chat-list">
          <button
            v-for="conversation in conversationsQuery.data.value"
            :key="conversationId(conversation)"
            class="chat-list-item"
            type="button"
            @click="selectConversation(conversation)"
          >
            <strong>{{ conversationTitle(conversation) }}</strong>
            <span>{{ conversation.lastMessagePreview ?? 'Sin mensajes' }}</span>
          </button>
        </div>

        <div v-else class="empty-state">
          No hay conversaciones.
        </div>
      </section>

      <section class="card chat-panel">
        <template v-if="selectedConversation">
          <div class="compact-header">
            <div>
              <p class="eyebrow">Conversación</p>
              <h3>{{ conversationTitle(selectedConversation) }}</h3>
            </div>
          </div>

          <div class="messages-list">
            <div
              v-for="message in messagesQuery.data.value ?? []"
              :key="message.id ?? message._id"
              class="message-bubble"
              :class="{ own: message.senderId === authStore.user?.domainId }"
            >
              <p>{{ message.body ?? attachmentLabel(message) }}</p>
              <small v-if="message.attachment">{{ attachmentLabel(message) }}</small>
              <span>{{ messageSenderName(message.senderId) }} · {{ formatDate(message.createdAt) }}</span>
            </div>
          </div>

          <form class="message-form" @submit.prevent="submitMessage">
            <textarea v-model="messageBody" rows="3" placeholder="Escribe un mensaje" />
            <input
              ref="fileInput"
              type="file"
              :accept="attachmentAccept"
              @change="onMessageFileChange"
            />
            <p v-if="messageFile" class="muted-text">
              Archivo listo: {{ messageFile.name }}
            </p>
            <p v-if="messageError" class="error-message">
              {{ messageError }}
            </p>
            <button class="primary-button" type="submit" :disabled="sendMessageMutation.isPending.value">
              Enviar
            </button>
          </form>
        </template>

        <div v-else class="empty-state">
          Selecciona una conversación para ver mensajes.
        </div>
      </section>
    </div>
  </AppLayout>
</template>
