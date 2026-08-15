import {
  chatMessageEnvelopeSchema,
  chatMessagesResponseSchema,
  chatRoomEnvelopeSchema,
  chatRoomsResponseSchema,
} from "@workspace/shared/communications"

import { apiJson } from "./api"

export const getChatRooms = () =>
  apiJson("/api/chat/rooms", chatRoomsResponseSchema)

export const createChatRoom = (input: {
  year: number
  name: string
  targets: Array<{
    targetType: "member" | "role" | "activity"
    targetId: string
  }>
}) =>
  apiJson("/api/chat/rooms", chatRoomEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const getChatMessages = (roomId: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    chatMessagesResponseSchema
  )

export const sendChatMessage = (
  roomId: string,
  input: { id: string; content: string }
) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    chatMessageEnvelopeSchema,
    { method: "POST", body: JSON.stringify(input) }
  )
