import { useRef, useState } from "react"
import { useNearHistory } from "@/components/chat/message/use-near-history"
import { keys } from "@/data/keys"
import { useQuery } from "@tanstack/react-query"
import { messageLinks } from "@workspace/shared/messages"
import { chatLinkImageUrl, getChatLinkPreview } from "@/api/chat"
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
  const ref = useRef<HTMLDivElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  // Fetch two screens ahead. Once fetched, the cached card stays when scrolled away.
  const near = useNearHistory(ref, 2)
  const query = useQuery({
    queryKey: keys.chatLinkPreview(roomId, messageId, url),
    queryFn: ({ signal }) => getChatLinkPreview(roomId, messageId, signal),
    enabled: near && !offline,
    staleTime: 86400000,
    retry: false,
  })
  const preview = query.data?.preview
  return (
    <div ref={ref}>
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
          {preview.image && !imageFailed && (
            <img
              src={chatLinkImageUrl(roomId, messageId)}
              alt=""
              className="h-28 w-28 shrink-0 object-cover"
              onError={() => setImageFailed(true)}
            />
          )}
        </a>
      )}
    </div>
  )
}
