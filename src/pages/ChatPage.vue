<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth.store'
import {
  createConversation,
  getConversations,
  getMessages,
  markConversationAsRead,
  sendMessage,
  type Conversation,
} from '../modules/chat/chat.api'

const authStore = useAuthStore()
const queryClient = useQueryClient()

const selectedConversation = ref<Conversation | null>(null)
const patientId = ref(authStore.role === 'PATIENT' ? authStore.user?.domainId ?? '' : '')
const dentistId = ref(authStore.role === 'DENTIST' ? authStore.user?.domainId ?? '' : '')
const messageBody = ref('')
const messageFile = ref<File | null>(null)

const conversationsQuery = useQuery({
  queryKey: ['chat', 'conversations'],
  queryFn: getConversations,
  refetchInterval: 15000,
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
    queryClient.invalidateQueries({ queryKey: ['chat'] })
  },
})

function conversationId(conversation: Conversation) {
  return conversation.id ?? conversation._id ?? ''
}

function conversationTitle(conversation: Conversation) {
  if (authStore.role === 'PATIENT') {
    return `Dentista ${conversation.dentistId}`
  }

  if (authStore.role === 'DENTIST') {
    return `Paciente ${conversation.patientId}`
  }

  return `${conversation.patientId} · ${conversation.dentistId}`
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
  if (!patientId.value || !dentistId.value) return

  await createConversationMutation.mutateAsync({
    patientId: patientId.value,
    dentistId: dentistId.value,
  })
}

function onMessageFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  messageFile.value = input.files?.[0] ?? null
}

async function submitMessage() {
  if (!selectedConversationId.value || (!messageBody.value && !messageFile.value)) {
    return
  }

  await sendMessageMutation.mutateAsync({
    conversationId: selectedConversationId.value,
    body: messageBody.value || undefined,
    file: messageFile.value,
  })
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
          <label>
            Paciente
            <input v-model="patientId" type="text" placeholder="patient_id" required />
          </label>

          <label>
            Dentista
            <input v-model="dentistId" type="text" placeholder="dentist_id" required />
          </label>

          <button class="primary-button" type="submit" :disabled="createConversationMutation.isPending.value">
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
              <p>{{ message.body ?? 'Adjunto enviado' }}</p>
              <span>{{ message.senderRole }} · {{ formatDate(message.createdAt) }}</span>
            </div>
          </div>

          <form class="message-form" @submit.prevent="submitMessage">
            <textarea v-model="messageBody" rows="3" placeholder="Escribe un mensaje" />
            <input type="file" @change="onMessageFileChange" />
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
