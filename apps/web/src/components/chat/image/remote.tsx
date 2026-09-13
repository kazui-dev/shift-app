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
  const element = useRef<HTMLButtonElement>(null)
  // An image already in memory shows on the first render, not after loading.
  const [src, setSrc] = useState(() =>
    cachedChatImage(state.member.studentId, roomId, id)
  )
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Load two screens ahead, and keep the image shown until six screens away so
  // scrolling back never finds it blank. Farther images return to the cache.
  const near = useNearHistory(element, 2)
  const kept = useNearHistory(element, 6)
  const acquired = useRef<ReturnType<typeof acquireChatImage> | null>(null)
  useEffect(
    () => () => {
      acquired.current?.release()
      acquired.current = null
    },
    [state.member.studentId, roomId, id, attempt]
  )
  useEffect(() => {
    if (!kept) {
      if (!acquired.current) return
      acquired.current.release()
      acquired.current = null
      setSrc(undefined)
      return
    }
    if (!near || acquired.current) return
    const image = acquireChatImage(state.member.studentId, roomId, id)
    acquired.current = image
    setFailed(false)
    void image.promise
      .then((url) => {
        if (acquired.current === image) setSrc(url)
      })
      .catch(() => {
        if (acquired.current === image) setFailed(true)
      })
  }, [near, kept, state.member.studentId, roomId, id, attempt])
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
        />
      ) : (
        <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {failed ? "再読み込み" : ""}
        </span>
      )}
    </button>
  )
}
