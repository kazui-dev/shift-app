import { useEffect, useEffectEvent, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useRouter, useRouterState } from "@tanstack/react-router"
import { getChatMessageAt } from "@/api/chat"
import { acquireChatImage, cachedChatImage } from "@/lib/chat-images"
import { ImageViewer } from "./image-viewer"
import { chatImageLocation } from "@/lib/chat-image-location"
type ChatMessage = Awaited<
  ReturnType<typeof getChatMessageAt>
>["messages"][number]

declare module "@tanstack/react-router" {
  interface HistoryState {
    chatImage?: boolean
  }
}

export function RoutedImage({
  roomId,
  messages,
}: {
  roomId: string
  messages: ChatMessage[]
}) {
  const router = useRouter()
  const { state } = getRouteApi("/_app").useRouteContext()
  const search = useRouterState({ select: (value) => value.location.search })
  const { image, message: sequence } = chatImageLocation(search)
  const cached = messages.find((message) => message.sequence === sequence)
  const query = useQuery({
    queryKey: ["chat-image-message", roomId, sequence],
    queryFn: () => getChatMessageAt(roomId, sequence ?? 0),
    enabled: !!image && sequence !== undefined && !cached,
    meta: { persist: false },
  })
  const message =
    cached ?? query.data?.messages.find((item) => item.sequence === sequence)
  const attachment = message?.attachments.find((item) => item.id === image)
  const close = () => {
    if (router.state.location.state.chatImage) router.history.back()
    else
      void router.navigate({
        to: "/chat/$roomId",
        params: { roomId },
        search: { report: search.report },
        replace: true,
      })
  }
  if (!image || !attachment || !message) return null
  return (
    <LoadedImage
      key={image}
      user={state.member.studentId}
      roomId={roomId}
      attachment={attachment}
      message={message}
      onClose={close}
    />
  )
}

function LoadedImage({
  user,
  roomId,
  attachment,
  message,
  onClose,
}: {
  user: string
  roomId: string
  attachment: ChatMessage["attachments"][number]
  message: ChatMessage
  onClose: () => void
}) {
  const [src, setSrc] = useState(() =>
    cachedChatImage(user, roomId, attachment.id)
  )
  const close = useEffectEvent(onClose)
  useEffect(() => {
    let active = true
    const image = acquireChatImage(user, roomId, attachment.id)
    void image.promise
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => {
        if (active) close()
      })
    return () => {
      active = false
      image.release()
    }
  }, [user, roomId, attachment.id])
  if (!src) return null
  return (
    <ImageViewer
      src={src}
      width={attachment.width}
      height={attachment.height}
      onClose={onClose}
      caption={{
        author: message.memberDisplayName,
        image: message.memberImage,
        content: message.content,
        createdAt: message.createdAt,
      }}
    />
  )
}
