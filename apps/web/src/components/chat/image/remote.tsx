import { useEffect, useRef, useState } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { acquireChatImage, cachedChatImage } from "@/lib/chat/images"
import { useNearHistory } from "@/components/chat/message/use-near-history"

export function RemoteImage({
  roomId,
  id,
  width,
  height,
  alt,
  fit = "contain",
  onOpen,
}: {
  roomId: string
  id: string
  width: number
  height: number
  alt: string
  fit?: "contain" | "cover"
  onOpen: (src: string) => void
}) {
  const { state } = getRouteApi("/_app").useRouteContext()
  const user = state.member.studentId
  const element = useRef<HTMLButtonElement>(null)
  // An image already in memory shows on the first render, not after loading.
  const [src, setSrc] = useState(() => cachedChatImage(user, roomId, id))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Start loading two screens ahead. Once shown, an image stays shown and held
  // until its message leaves the history, so it never blinks back to empty.
  const near = useNearHistory(element, 2)
  const held = useRef<ReturnType<typeof acquireChatImage> | null>(null)
  useEffect(
    () => () => {
      held.current?.release()
      held.current = null
    },
    [user, roomId, id, attempt]
  )
  useEffect(() => {
    // A shown image is held, so the memory cache never revokes its URL.
    if (held.current || (!near && !src)) return
    const image = acquireChatImage(user, roomId, id)
    held.current = image
    setFailed(false)
    void image.promise
      .then((url) => {
        if (held.current === image) setSrc(url)
      })
      .catch(() => {
        if (held.current === image) setFailed(true)
      })
  }, [near, src, user, roomId, id, attempt])
  return (
    <button
      data-page-swipe
      ref={element}
      type="button"
      aria-label={failed ? "画像を再読み込み" : alt}
      onClick={() =>
        src ? onOpen(src) : failed && setAttempt((value) => value + 1)
      }
      className="size-full overflow-hidden bg-muted/30 text-left"
    >
      {src ? (
        <img
          src={src}
          width={width}
          height={height}
          alt={alt}
          draggable={false}
          className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
          onError={() => {
            // The URL was revoked or broke: load the image again.
            setSrc(undefined)
            setAttempt((value) => value + 1)
          }}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {failed ? "再読み込み" : ""}
        </span>
      )}
    </button>
  )
}
