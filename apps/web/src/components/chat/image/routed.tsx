import { useEffect, useEffectEvent, useMemo, useState } from "react"
import { useCloseOverlay } from "@/components/chat/overlay"
import { keys } from "@/data/keys"
import { useQuery } from "@tanstack/react-query"
import {
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { getChatMessageAt } from "@/api/chat"
import { acquireChatImage, cachedChatImage } from "@/lib/chat/images"
import { ImageViewer } from "@/components/chat/image/viewer"
import { adjacentImages, chatImageLocation } from "@/lib/chat/image-location"
type ChatMessage = Awaited<
  ReturnType<typeof getChatMessageAt>
>["messages"][number]

export function RoutedImage({
  roomId,
  messages,
}: {
  roomId: string
  messages: ChatMessage[]
}) {
  const { state } = getRouteApi("/_app").useRouteContext()
  const search = useRouterState({ select: (value) => value.location.search })
  const { image, message: sequence } = chatImageLocation(search)
  const cached = messages.find((message) => message.sequence === sequence)
  const query = useQuery({
    queryKey: keys.chatImageMessage(roomId, sequence),
    queryFn: () => getChatMessageAt(roomId, sequence ?? 0),
    enabled: !!image && sequence !== undefined && !cached,
    meta: { persist: false },
  })
  const message =
    cached ?? query.data?.messages.find((item) => item.sequence === sequence)
  const attachment = message?.attachments.find((item) => item.id === image)
  const close = useCloseOverlay("image", {
    to: "/chat/$roomId",
    params: { roomId },
    search: { report: search.report },
  })
  const navigate = useNavigate()
  const { previous, next } = adjacentImages(
    message?.attachments.map((item) => item.id) ?? [],
    image ?? ""
  )
  const neighbors = useMemo(
    () => [previous, next].filter((id) => id !== undefined),
    [previous, next]
  )
  // Replace the entry, so back closes the viewer instead of stepping through images.
  const show = (target: string) =>
    void navigate({
      to: "/chat/$roomId",
      params: { roomId },
      search: { report: search.report, image: target, message: sequence },
      state: { chatOverlay: "image" },
      replace: true,
      resetScroll: false,
    })
  if (!image || !attachment || !message) return null
  return (
    <LoadedImage
      key={image}
      user={state.member.studentId}
      roomId={roomId}
      attachment={attachment}
      message={message}
      neighbors={neighbors}
      navigation={{
        count: message.attachments.length,
        onPrevious: previous ? () => show(previous) : undefined,
        onNext: next ? () => show(next) : undefined,
      }}
      onClose={close}
    />
  )
}

function LoadedImage({
  user,
  roomId,
  attachment,
  message,
  neighbors,
  navigation,
  onClose,
}: {
  user: string
  roomId: string
  attachment: ChatMessage["attachments"][number]
  message: ChatMessage
  neighbors: string[]
  navigation: {
    count: number
    onPrevious: (() => void) | undefined
    onNext: (() => void) | undefined
  }
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
  // Keep the neighbouring images ready, so moving between them shows at once.
  useEffect(() => {
    const held = neighbors.map((id) => acquireChatImage(user, roomId, id))
    for (const image of held) void image.promise.catch(() => undefined)
    return () => {
      for (const image of held) image.release()
    }
  }, [user, roomId, neighbors])
  if (!src) return null
  return (
    <ImageViewer
      src={src}
      width={attachment.width}
      height={attachment.height}
      onClose={onClose}
      navigation={navigation}
      caption={{
        author: message.memberDisplayName,
        image: message.memberImage,
        content: message.content,
        createdAt: message.createdAt,
      }}
    />
  )
}
