import { useRef } from "react"
import { useChatMember } from "@/components/chat/use-chat-member"
import type { ChatImageSize } from "@workspace/shared/communications"
import {
  acquireChatImage,
  cachedChatImage,
  sentChatImage,
} from "@/lib/chat/images"
import { useNearHistory } from "@/components/chat/message/use-near-history"
import { useHeldImage } from "@/components/chat/image/use-held-image"

export function RemoteImage({
  roomId,
  id,
  size,
  width,
  height,
  alt,
  fit = "contain",
  onOpen,
}: {
  roomId: string
  id: string
  size: ChatImageSize
  width: number
  height: number
  alt: string
  fit?: "contain" | "cover"
  onOpen: () => void
}) {
  const user = useChatMember().studentId
  const element = useRef<HTMLButtonElement>(null)
  // Loading starts two screens ahead. A tile in memory, or this device's preview
  // of an image it just sent, shows on the first render until the tile decodes.
  const near = useNearHistory(element, 2)
  const image = useHeldImage(
    () => acquireChatImage(user, roomId, id, size),
    near,
    () =>
      cachedChatImage(user, roomId, id, size) ?? sentChatImage(user, roomId, id)
  )
  return (
    <button
      data-page-swipe
      ref={element}
      type="button"
      aria-label={image.failed && !image.src ? "画像を再読み込み" : alt}
      onClick={() => (image.src ? onOpen() : image.failed && image.retry())}
      className="size-full overflow-hidden bg-muted/30 text-left"
    >
      {image.src ? (
        <img
          src={image.src}
          width={width}
          height={height}
          alt={alt}
          draggable={false}
          className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
          // The URL was revoked or broke: load the image again.
          onError={image.retry}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {image.failed ? "再読み込み" : ""}
        </span>
      )}
    </button>
  )
}
