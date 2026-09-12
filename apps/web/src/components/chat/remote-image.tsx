import { useEffect, useRef, useState } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { acquireChatImage } from "@/lib/chat-images"

export function RemoteImage({
  roomId,
  id,
  width,
  height,
  alt,
  onOpen,
}: {
  roomId: string
  id: string
  width: number
  height: number
  alt: string
  onOpen: (src: string) => void
}) {
  const { state } = getRouteApi("/_app").useRouteContext()
  const element = useRef<HTMLButtonElement>(null)
  const [src, setSrc] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const target = element.current
    if (!target) return undefined
    let active = true
    let release: (() => void) | undefined
    setFailed(false)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          release?.()
          release = undefined
          setSrc(undefined)
          return
        }
        if (release) return
        const image = acquireChatImage(state.member.studentId, roomId, id)
        release = image.release
        void image.promise
          .then((url) => {
            if (active && release === image.release) setSrc(url)
          })
          .catch(() => {
            if (active && release === image.release) setFailed(true)
          })
      },
      { rootMargin: "300px" }
    )
    observer.observe(target)
    return () => {
      active = false
      observer.disconnect()
      release?.()
    }
  }, [state.member.studentId, roomId, id, attempt])
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
          className="size-full object-contain"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {failed ? "再読み込み" : ""}
        </span>
      )}
    </button>
  )
}
