import { useEffect, useState } from "react"
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
import { chatImageLocation } from "@/lib/chat/image-location"
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
  const close = useCloseOverlay("image", {
    to: "/chat/$roomId",
    params: { roomId },
    search: { report: search.report },
  })
  const navigate = useNavigate()
  if (!image || !message?.attachments.some((item) => item.id === image))
    return null
  return (
    <MessageGallery
      key={message.id}
      user={state.member.studentId}
      roomId={roomId}
      message={message}
      initial={image}
      onClose={close}
      // Replace the entry, so back closes the viewer instead of stepping through images.
      onShow={(target) =>
        void navigate({
          to: "/chat/$roomId",
          params: { roomId },
          search: { report: search.report, image: target, message: sequence },
          state: { chatOverlay: "image" },
          replace: true,
          resetScroll: false,
        })
      }
    />
  )
}

/** Every image of one message, loaded together so moving between them never waits. */
function MessageGallery({
  user,
  roomId,
  message,
  initial,
  onClose,
  onShow,
}: {
  user: string
  roomId: string
  message: ChatMessage
  initial: string
  onClose: () => void
  onShow: (id: string) => void
}) {
  const attachments = message.attachments
  const [sources, setSources] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      attachments.flatMap((attachment) => {
        const url = cachedChatImage(user, roomId, attachment.id)
        return url ? [[attachment.id, url]] : []
      })
    )
  )
  const [initialIndex] = useState(() =>
    attachments.findIndex((attachment) => attachment.id === initial)
  )
  useEffect(() => {
    let active = true
    const held = attachments.map((attachment) => {
      const image = acquireChatImage(user, roomId, attachment.id)
      void image.promise
        .then((url) => {
          if (active)
            setSources((current) => ({ ...current, [attachment.id]: url }))
        })
        .catch(() => {
          if (active)
            setSources((current) => ({ ...current, [attachment.id]: null }))
        })
      return image
    })
    return () => {
      active = false
      for (const image of held) image.release()
    }
  }, [user, roomId, attachments])
  return (
    <ImageViewer
      images={attachments.map((attachment) => ({
        id: attachment.id,
        width: attachment.width,
        height: attachment.height,
        src: sources[attachment.id],
      }))}
      initialIndex={Math.max(0, initialIndex)}
      onIndexChange={(index) => {
        const attachment = attachments[index]
        if (attachment) onShow(attachment.id)
      }}
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
