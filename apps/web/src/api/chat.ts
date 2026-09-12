import type { ChatTargetOption } from "@workspace/shared/communications"
import {
  chatMessageEnvelopeSchema,
  chatAttachmentEnvelopeSchema,
  chatMembersResponseSchema,
  chatMessagesResponseSchema,
  chatRoomEnvelopeSchema,
  chatRoomsResponseSchema,
  chatTargetsResponseSchema,
  roomSettingsInputSchema,
  roomSettingsResponseSchema,
} from "@workspace/shared/communications"

import { apiJson, apiVoid } from "./client"

export const getChatRooms = (year: number) =>
  apiJson(`/api/chat/rooms?year=${year}`, chatRoomsResponseSchema)

export const getChatTargets = (year: number) =>
  apiJson(`/api/chat/targets?year=${year}`, chatTargetsResponseSchema)

export const createChatRoom = (input: {
  year: number
  name: string
  targets: Array<{
    targetType: ChatTargetOption["targetType"]
    targetId: string
  }>
}) =>
  apiJson("/api/chat/rooms", chatRoomEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const getChatMessages = (roomId: string, before: number | null = null) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages${before === null ? "" : `?before=${before}`}`,
    chatMessagesResponseSchema
  )

export const sendChatMessage = (
  roomId: string,
  input: { id: string; content: string; attachmentIds: string[] }
) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    chatMessageEnvelopeSchema,
    { method: "POST", body: JSON.stringify(input) }
  )

export const updateChatPreferences = (
  id: string,
  input: { muted?: boolean; lastRead?: number }
) =>
  apiVoid(`/api/chat/rooms/${encodeURIComponent(id)}/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
export const getRoomSettings = (id: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(id)}/settings`,
    roomSettingsResponseSchema
  )
export const saveRoomSettings = (
  id: string,
  input: import("valibot").InferOutput<typeof roomSettingsInputSchema>
) =>
  apiVoid(`/api/chat/rooms/${encodeURIComponent(id)}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      allowExit: input.allowExit,
      targets: input.targets,
    }),
  })

export const leaveChatRoom = (id: string) =>
  apiVoid(`/api/me/chat-memberships/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

export const getChatRoom = (roomId: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}`,
    chatRoomEnvelopeSchema
  )
export const chatImageUrl = (roomId: string, id: string) =>
  `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments/${encodeURIComponent(id)}`
export const uploadChatImage = (roomId: string, blob: Blob) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments`,
    chatAttachmentEnvelopeSchema,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    }
  )

export const getChatMembers = (roomId: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/members`,
    chatMembersResponseSchema
  )
