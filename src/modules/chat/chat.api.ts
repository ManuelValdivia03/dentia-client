import { api } from '../../app/api'

export interface Conversation {
  id?: string
  _id?: string
  patientId: string
  dentistId: string
  isActive?: boolean
  lastMessagePreview?: string
  lastMessageAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface ChatMessage {
  id?: string
  _id?: string
  conversationId: string
  senderId: string
  senderRole: string
  type?: string
  body?: string
  attachment?: unknown
  createdAt?: string
  updatedAt?: string
}

export interface CreateConversationPayload {
  patientId: string
  dentistId: string
}

export interface SendMessagePayload {
  conversationId: string
  body?: string
  file?: File | null
}

export async function getConversations() {
  const { data } = await api.get<Conversation[]>('/chat/conversations')
  return data
}

export async function createConversation(payload: CreateConversationPayload) {
  const { data } = await api.post<Conversation>('/chat/conversations', payload)
  return data
}

export async function getMessages(conversationId: string) {
  const { data } = await api.get<ChatMessage[]>(
    `/chat/conversations/${conversationId}/messages`,
  )
  return data
}

export async function sendMessage({
  conversationId,
  body,
  file,
}: SendMessagePayload) {
  const formData = new FormData()

  if (body) {
    formData.append('body', body)
  }

  if (file) {
    formData.append('file', file)
  }

  const { data } = await api.post<ChatMessage>(
    `/chat/conversations/${conversationId}/messages`,
    formData,
  )
  return data
}

export async function markConversationAsRead(conversationId: string) {
  const { data } = await api.patch(
    `/chat/conversations/${conversationId}/read`,
  )
  return data
}
