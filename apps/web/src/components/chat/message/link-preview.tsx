import { useRef } from "react"
import { useChatMember } from "@/components/chat/use-chat-member"
import { useNearHistory } from "@/components/chat/message/use-near-history"
import { useQuery } from "@tanstack/react-query"
import { messageLinks } from "@workspace/shared/messages"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { linkPreviewQuery } from "@/data/chat"
import { acquireLinkImage, cachedLinkImage } from "@/lib/chat/images"
import { useHeldImage } from "@/components/chat/image/use-held-image"
export function MessageLinkPreview({
  roomId,
  messageId,
  content,
  offline,
}: {
  roomId: string
  messageId: string
  content: string
  offline: boolean
}) {
  const url = messageLinks(content).find((part) => part.href)?.href
  if (!url) return null
  return (
    <LinkPreview
      key={url}
      roomId={roomId}
      messageId={messageId}
      url={url}
      offline={offline}
    />
  )
}
function LinkPreview({
  roomId,
  messageId,
  url,
  offline,
}: {
  roomId: string
  messageId: string
  url: string
  offline: boolean
}) {
  const user = useChatMember().studentId
  const ref = useRef<HTMLDivElement>(null)
  // Fetch two screens ahead. Once fetched, the cached card stays when scrolled away.
  const near = useNearHistory(ref, 2)
  const query = useQuery({
    ...linkPreviewQuery(roomId, messageId, url),
    enabled: near && !offline,
  })
  const preview = query.data?.preview
  const hasImage = !!preview?.image
  // Held like a list tile: from memory at once, else from this device or the network.
  const image = useHeldImage(
    () => acquireLinkImage(user, roomId, messageId, url),
    hasImage,
    () => cachedLinkImage(user, roomId, messageId, url)
  )
  // Hold the card's space until the preview settles, so reading never jumps.
  const settling = !offline && query.data === undefined && !query.isError
  return (
    <div ref={ref} data-message-media={preview || settling ? "" : undefined}>
      {settling && (
        <Skeleton aria-hidden className="mt-1 h-28 max-w-lg rounded-lg" />
      )}
      {preview && (
        <a
          href={url}
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
          {hasImage &&
            !image.failed &&
            (image.src ? (
              <img
                src={image.src}
                alt=""
                className="h-28 w-28 shrink-0 object-cover"
                onError={image.retry}
              />
            ) : (
              <span aria-hidden className="h-28 w-28 shrink-0 bg-muted" />
            ))}
        </a>
      )}
    </div>
  )
}
