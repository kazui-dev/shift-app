import * as v from "valibot"
import type {
  ChatImageSize,
  ChatTargetOption,
} from "@workspace/shared/communications"
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

import { apiBlob, apiJson, apiUpload, apiVoid } from "../../../lib/http/client"

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
  input: {
    id: string
    content: string
    attachmentIds: string[]
    replyToId?: string
  },
  signal?: AbortSignal
) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    chatMessageEnvelopeSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
      ...(signal ? { signal } : {}),
    }
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
export const deleteChatRoom = (id: string) =>
  apiVoid(`/api/chat/rooms/${encodeURIComponent(id)}`, { method: "DELETE" })

export const getChatMessageAt = (roomId: string, sequence: number) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages?before=${sequence + 1}&limit=1`,
    chatMessagesResponseSchema
  )

export const getChatRoom = (roomId: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}`,
    chatRoomEnvelopeSchema
  )
export type ChatRoom = Awaited<ReturnType<typeof getChatRoom>>["room"]
const chatImageUrl = (roomId: string, id: string, size?: ChatImageSize) =>
  `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments/${encodeURIComponent(id)}${size ? `?size=${size}` : ""}`
/** Uploads an image, or a display copy whose original follows when `copy` is set. */
export const uploadChatImage = (
  roomId: string,
  upload: { name: string; blob: Blob; copy: boolean },
  options?: Parameters<typeof apiUpload>[3]
) =>
  apiUpload(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments?name=${encodeURIComponent(upload.name)}${upload.copy ? "&copy=1" : ""}`,
    chatAttachmentEnvelopeSchema,
    upload.blob,
    options
  )

/** Sends a display copy's original, which takes the copy's place. */
export const uploadChatOriginal = (
  roomId: string,
  id: string,
  file: { name: string; blob: Blob },
  options?: Parameters<typeof apiUpload>[3]
) =>
  apiUpload(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments/${encodeURIComponent(id)}/original?name=${encodeURIComponent(file.name)}`,
    v.undefined(),
    file.blob,
    { ...options, method: "PUT" }
  )

/** Gives up a display copy's original, so the copy stands as it. */
export const keepChatImageCopy = (roomId: string, id: string) =>
  apiVoid(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments/${encodeURIComponent(id)}/original`,
    { method: "DELETE" }
  )

/** Takes back an uploaded image that no message has claimed. */
export const deleteChatAttachment = (roomId: string, id: string) =>
  apiVoid(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/attachments/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  )

export const getChatMembers = (roomId: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/members`,
    chatMembersResponseSchema
  )

export const getChatImage = (
  roomId: string,
  id: string,
  size: ChatImageSize,
  signal: AbortSignal
) => apiBlob(chatImageUrl(roomId, id, size), signal)
export const getChatOriginal = (
  roomId: string,
  id: string,
  signal: AbortSignal
) => apiBlob(chatImageUrl(roomId, id), signal)

export const editChatMessage = (roomId: string, id: string, content: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(id)}`,
    chatMessageEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify({ content }) }
  )
export const deleteChatMessage = (roomId: string, id: string) =>
  apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(id)}`,
    chatMessageEnvelopeSchema,
    { method: "DELETE" }
  )

export const searchChatMessages = (
  roomId: string,
  query: string,
  before: number | null,
  signal: AbortSignal
) => {
  const params = new URLSearchParams({ q: query, limit: "30" })
  if (before !== null) params.set("before", String(before))
  return apiJson(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages?${params}`,
    chatMessagesResponseSchema,
    { signal }
  )
}

export const getChatLinkImage = (
  roomId: string,
  messageId: string,
  signal: AbortSignal
) =>
  apiBlob(
    `/api/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/link-preview/image`,
    signal
  )
