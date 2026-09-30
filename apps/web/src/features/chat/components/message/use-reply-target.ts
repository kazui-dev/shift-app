import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@workspace/ui/lib/toast"
import type { useMessages } from "@/features/chat/components/message/use-history"
import type { useMessageScroll } from "@/features/chat/components/message/use-scroll"

export function useReplyTarget(
  history: ReturnType<typeof useMessages>,
  scroll: ReturnType<typeof useMessageScroll>,
  active: boolean,
  offline: boolean
) {
  const replyTarget = useRef<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
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
    const target = replyTarget.current
    if (requestVersion === 0 || !target || !active) return
    if (scroll.target(target)) {
      const row = scroll.content.current?.querySelector(
        `[data-message-id="${CSS.escape(target)}"] [data-message-actions]`
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
                offset: 120 / 1280,
              },
              {
                backgroundColor: "rgba(59, 130, 246, .18)",
                offset: 1120 / 1280,
              },
              { backgroundColor: "rgba(59, 130, 246, 0)", offset: 1 },
            ],
            { duration: 1280, easing: "linear" }
          ) ?? null
      }
      const list = scroll.viewport.current
      if (list && !reduced && !scroll.arrived(target)) {
        const cancel = () => {
          list.removeEventListener("scroll", arrived)
          list.removeEventListener("wheel", cancel)
          list.removeEventListener("touchstart", cancel)
          list.removeEventListener("pointerdown", cancel)
          list.removeEventListener("keydown", cancel)
        }
        const arrived = () => {
          if (!scroll.arrived(target)) return
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
      replyTarget.current = null
    } else if (!history.query.isFetchingNextPage) {
      if (history.query.hasNextPage && !offline) {
        void history.query.fetchNextPage().then((result) => {
          if (result.isError) {
            if (replyTarget.current === target) replyTarget.current = null
            toast.error("メッセージを読み込めませんでした。")
          }
        })
      } else {
        replyTarget.current = null
      }
    }
  }, [requestVersion, active, scroll, history.query, offline])
  return useCallback((target: string | null) => {
    replyTarget.current = target
    setRequestVersion((version) => version + 1)
  }, [])
}
