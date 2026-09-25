import { useRef } from "react"
import type { LinkPreview } from "@workspace/shared/communications"
import { useChatMember } from "@/features/chat/hooks/use-chat-member"
import { useNearHistory } from "@/features/chat/components/message/use-near-history"
import { acquireLinkImage, cachedLinkImage } from "@/features/chat/lib/images"
import { useHeldImage } from "@/features/chat/components/image/use-held-image"

/**
 * A message's link card. The preview comes with the message, so the card has
 * its size from the first render and never shifts the history.
 */
export function MessageLinkPreview({
  roomId,
  messageId,
  preview,
}: {
  roomId: string
  messageId: string
  preview: LinkPreview
}) {
  const user = useChatMember().studentId
  const ref = useRef<HTMLAnchorElement>(null)
  // The image loads two screens ahead, held like a list tile.
  const near = useNearHistory(ref, 2)
  const image = useHeldImage(
    () => acquireLinkImage(user, roomId, messageId, preview.url),
    near && !!preview.image,
    () => cachedLinkImage(user, roomId, messageId, preview.url)
  )
  return (
    <a
      ref={ref}
      data-message-media
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex h-28 max-w-lg overflow-hidden rounded-lg border bg-muted/40 text-left select-text"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {preview.site}
        </span>
        <span className="line-clamp-2 text-sm font-medium">
          {preview.title}
        </span>
        {preview.description && (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {preview.description}
          </span>
        )}
      </div>
      {/* A stored image was made once, so its place stays while it loads or fails to. */}
      {preview.image &&
        (image.src ? (
          <img
            src={image.src}
            alt=""
            className="h-28 w-28 shrink-0 object-cover"
            onError={image.retry}
          />
        ) : (
          <span aria-hidden className="h-28 w-28 shrink-0" />
        ))}
    </a>
  )
}
