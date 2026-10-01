import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "@workspace/ui/lib/toast"
import type { useMessages } from "@/features/chat/components/message/use-history"
import type { useMessageScroll } from "@/features/chat/components/message/use-scroll"

export function useReplyTarget(
  history: ReturnType<typeof useMessages>,
  scroll: ReturnType<typeof useMessageScroll>,
  active: boolean,
  offline: boolean
) {
  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const requested = useRef<string | null>(null)
  const arrival = useRef<(() => void) | null>(null)
  const highlight = useRef<Animation | null>(null)
  const latestScroll = useRef(scroll)
  latestScroll.current = scroll
  const currentScroll = useEffectEvent(() => scroll)
  const select = useCallback((id: string | null) => {
    latestScroll.current.interrupt()
    arrival.current?.()
    highlight.current?.cancel()
    requested.current = id
    setReplyTarget(id)
  }, [])

  useEffect(() => {
    if (!active) select(null)
    return () => {
      arrival.current?.()
      highlight.current?.cancel()
    }
  }, [active, select])

  // This listener also cancels a jump while older pages are still loading.
  useEffect(() => {
    const list = scroll.viewport.current
    if (!replyTarget || !active || !list) return undefined
    const cancel = () => {
      currentScroll().interrupt()
      select(null)
    }
    list.addEventListener("wheel", cancel, { passive: true })
    list.addEventListener("touchstart", cancel, { passive: true })
    list.addEventListener("pointerdown", cancel)
    list.addEventListener("keydown", cancel, true)
    return () => {
      list.removeEventListener("wheel", cancel)
      list.removeEventListener("touchstart", cancel)
      list.removeEventListener("pointerdown", cancel)
      list.removeEventListener("keydown", cancel, true)
    }
  }, [replyTarget, active, scroll.viewport, select])

  useEffect(() => {
    if (!replyTarget || !active || arrival.current) return
    if (scroll.target(replyTarget)) {
      let frame = 0
      let settled = 0
      const stop = () => {
        cancelAnimationFrame(frame)
        arrival.current = null
      }
      arrival.current = stop
      const check = () => {
        const view = currentScroll()
        if (
          !view.isTargeting(replyTarget) ||
          view.view.locate(replyTarget) === null
        ) {
          select(null)
          return
        }
        // Look up the element after arrival: it did not exist at departure.
        const row = view.view.element(replyTarget)
        settled = row && view.arrived(replyTarget) ? settled + 1 : 0
        if (settled < 2) {
          frame = requestAnimationFrame(check)
          return
        }
        stop()
        view.finishTarget(replyTarget)
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
        highlight.current =
          row?.querySelector("[data-message-actions]")?.animate(
            reduced
              ? [
                  { backgroundColor: "rgba(59, 130, 246, .18)" },
                  { backgroundColor: "rgba(59, 130, 246, .18)" },
                ]
              : [
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
        requested.current = null
        setReplyTarget(null)
      }
      frame = requestAnimationFrame(check)
    } else if (!history.query.isFetchingNextPage) {
      if (history.query.hasNextPage && !offline) {
        void history.query.fetchNextPage().then((result) => {
          if (result.isError && requested.current === replyTarget) {
            select(null)
            toast.error("メッセージを読み込めませんでした。")
          }
        })
      } else select(null)
    }
  }, [replyTarget, active, scroll, history.query, offline, select])
  return select
}
