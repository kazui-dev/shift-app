import { useEffect, useRef, useState } from "react"
import { toast } from "@workspace/ui/lib/toast"
import type { useMessages } from "./use-messages"
import type { useMessageScroll } from "./use-message-scroll"

export function useReplyTarget(
  history: ReturnType<typeof useMessages>,
  scroll: ReturnType<typeof useMessageScroll>,
  active: boolean,
  offline: boolean
) {
  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const arrival = useRef<(() => void) | null>(null)
  const highlight = useRef<Animation | null>(null)
  useEffect(
    () => () => {
      highlight.current?.cancel()
      arrival.current?.()
    },
    []
  )
  useEffect(() => {
    if (!replyTarget || !active) return
    if (scroll.target(replyTarget)) {
      const row = scroll.content.current?.querySelector(
        `[data-message-id="${CSS.escape(replyTarget)}"] [data-message-actions]`
      )
      arrival.current?.()
      highlight.current?.cancel()
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      const show = () => {
        highlight.current =
          row?.animate(
            [
              { backgroundColor: "rgba(59, 130, 246, 0)", offset: 0 },
              {
                backgroundColor: "rgba(59, 130, 246, .18)",
                offset: reduced ? 0 : 0.12,
              },
              { backgroundColor: "rgba(59, 130, 246, .18)", offset: 0.65 },
              { backgroundColor: "rgba(59, 130, 246, 0)", offset: 1 },
            ],
            { duration: reduced ? 1000 : 2000, easing: "ease-out" }
          ) ?? null
      }
      const list = scroll.viewport.current
      if (list && !reduced && !scroll.arrived(replyTarget)) {
        const cancel = () => {
          list.removeEventListener("scroll", arrived)
          list.removeEventListener("wheel", cancel)
          list.removeEventListener("touchstart", cancel)
          list.removeEventListener("pointerdown", cancel)
          list.removeEventListener("keydown", cancel)
        }
        const arrived = () => {
          if (!scroll.arrived(replyTarget)) return
          cancel()
          show()
        }
        list.addEventListener("scroll", arrived, { passive: true })
        list.addEventListener("wheel", cancel, { passive: true })
        list.addEventListener("touchstart", cancel, { passive: true })
        list.addEventListener("pointerdown", cancel)
        list.addEventListener("keydown", cancel)
        arrival.current = cancel
      } else show()
      setReplyTarget(null)
    } else if (!history.query.isFetchingNextPage) {
      if (history.query.hasNextPage && !offline) {
        void history.query.fetchNextPage().then((result) => {
          if (result.isError) {
            setReplyTarget(null)
            toast.error("返信先を読み込めませんでした。")
          }
        })
      } else {
        setReplyTarget(null)
      }
    }
  }, [replyTarget, active, scroll, history.query, offline])
  return setReplyTarget
}
