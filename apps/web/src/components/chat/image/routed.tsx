import { useEffect, useRef, useState } from "react"
import { useCloseOverlay } from "@/components/chat/overlay"
import { keys } from "@/data/keys"
import { useQuery } from "@tanstack/react-query"
import {
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import type { ChatImageSize } from "@workspace/shared/communications"
import { toast } from "@workspace/ui/lib/toast"
import { getChatMessageAt } from "@/api/chat"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  acquireChatImage,
  acquireChatOriginal,
  cachedChatImage,
} from "@/lib/chat/images"
import { saveImage } from "@/lib/chat/save-image"
import { ImageViewer } from "@/components/chat/image/viewer"
import { chatImageLocation } from "@/lib/chat/image-location"
type ChatMessage = Awaited<
  ReturnType<typeof getChatMessageAt>
>["messages"][number]
type Attachment = ChatMessage["attachments"][number]

const noAttachments: Attachment[] = []

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

/** One size of every image, held until the viewer closes. */
function useImages(
  user: string,
  roomId: string,
  attachments: Attachment[],
  size: ChatImageSize
) {
  const [sources, setSources] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      attachments.flatMap((attachment) => {
        const url = cachedChatImage(user, roomId, attachment.id, size)
        return url ? [[attachment.id, url]] : []
      })
    )
  )
  useEffect(() => {
    let active = true
    const held = attachments.map((attachment) => {
      const image = acquireChatImage(user, roomId, attachment.id, size)
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
  }, [user, roomId, attachments, size])
  return sources
}

/**
 * Every image of one message. Each first shows the tile this device already
 * has and sharpens to 2400px once decoded; the originals of the image in view
 * and its neighbours load ahead, so saving opens at once.
 */
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
  const touch = useMediaQuery("(pointer: coarse)")
  const [initialIndex] = useState(() =>
    Math.max(
      0,
      attachments.findIndex((attachment) => attachment.id === initial)
    )
  )
  const [index, setIndex] = useState(initialIndex)
  const large = useImages(user, roomId, attachments, 2400)
  const thumbs = useImages(
    user,
    roomId,
    attachments.length > 1 ? attachments : noAttachments,
    640
  )
  const originals = useRef(
    new Map<string, ReturnType<typeof acquireChatOriginal>>()
  )
  useEffect(() => {
    const held = originals.current
    const wanted = new Set(
      attachments
        .slice(Math.max(0, index - 1), index + 2)
        .map((attachment) => attachment.id)
    )
    for (const [id, original] of held)
      if (!wanted.has(id)) {
        original.release()
        held.delete(id)
      }
    for (const id of wanted)
      if (!held.has(id)) held.set(id, acquireChatOriginal(user, roomId, id))
  }, [user, roomId, attachments, index])
  useEffect(() => {
    const held = originals.current
    return () => {
      for (const original of held.values()) original.release()
      held.clear()
    }
  }, [])
  const tile = (id: string) =>
    cachedChatImage(user, roomId, id, 1280) ??
    cachedChatImage(user, roomId, id, 640)
  function save() {
    const attachment = attachments[index]
    const original = attachment && originals.current.get(attachment.id)
    if (!attachment || !original) return
    void original.promise
      .then((blob) => saveImage(blob, attachment.name, touch))
      .catch(() => toast.error("画像を保存できませんでした。"))
  }
  return (
    <ImageViewer
      images={attachments.map((attachment) => {
        const sharp = large[attachment.id]
        return {
          id: attachment.id,
          width: attachment.width,
          height: attachment.height,
          src: sharp ?? tile(attachment.id) ?? sharp,
          thumb: thumbs[attachment.id] ?? tile(attachment.id),
        }
      })}
      initialIndex={initialIndex}
      onIndexChange={(target) => {
        setIndex(target)
        const attachment = attachments[target]
        if (attachment) onShow(attachment.id)
      }}
      onSave={save}
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
