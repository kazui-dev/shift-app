import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useHistoryView } from "@/features/chat/components/message/use-history-view"
import {
  MessageScroll,
  type ScrollPosition,
  type ScrollStatus,
} from "@/features/chat/components/message/scroll"
import {
  unreadMessage,
  type MessageRow,
} from "@/features/chat/components/message/list"

const positions = new Map<string, ScrollPosition>()

export function useMessageScroll(
  roomId: string,
  active: boolean,
  rows: MessageRow[],
  initialRead: number,
  memberId: string,
  markRead: () => void,
  loaded: boolean
) {
  const firstUnread = useMemo(
    () => unreadMessage(rows, initialRead, memberId),
    [rows, initialRead, memberId]
  )
  const view = useHistoryView(roomId, rows)
  const { viewport, content } = view
  const currentView = useRef(view)
  currentView.current = view
  const controller = useRef<MessageScroll | null>(null)
  const followNext = useRef(false)
  const [status, setStatus] = useState<ScrollStatus>({
    atBottom: true,
    showLatest: false,
  })

  useLayoutEffect(() => {
    const list = viewport.current,
      body = content.current
    if (!list || !body || !active) return undefined
    const scroll = new MessageScroll(
      {
        top: () => list.scrollTop,
        height: () => list.clientHeight,
        extent: () => list.scrollHeight,
        move: (top, smooth) =>
          list.scrollTo({ top, behavior: smooth ? "smooth" : "instant" }),
        anchor: () => currentView.current.anchor(),
        locate: (id) => currentView.current.locate(id),
        measured: (id) => currentView.current.measured(id),
        nearest: (index, sequence) =>
          currentView.current.nearest(index, sequence),
      },
      (next) =>
        setStatus((previous) =>
          previous.atBottom === next.atBottom &&
          previous.showLatest === next.showLatest
            ? previous
            : next
        ),
      positions.get(roomId)
    )
    list.tabIndex = 0
    // Capture before the virtualizer flushes newly visible rows.
    const capture = () => scroll.scroll()
    list.addEventListener("scroll", capture, true)
    controller.current = scroll
    let touch: { x: number; y: number } | null = null
    const start = (event: TouchEvent) => {
      scroll.interrupt()
      const point = event.touches[0]
      touch = point ? { x: point.clientX, y: point.clientY } : null
    }
    const move = (event: TouchEvent) => {
      const point = event.touches[0]
      if (!point || !touch) return
      const dy = Math.abs(point.clientY - touch.y)
      if (dy > 5 && dy > Math.abs(point.clientX - touch.x)) scroll.read()
    }
    const wheel = (event: WheelEvent) => {
      if (event.deltaY) scroll.read()
    }
    const key = (event: KeyboardEvent) => {
      const control = event.target instanceof Element ? event.target : null
      if (
        !control?.closest('input,textarea,select,[contenteditable="true"]') &&
        !(event.key === " " && control?.closest('button,[role="button"]')) &&
        [
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown",
          " ",
        ].includes(event.key)
      ) {
        event.preventDefault()
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
        if (event.key === "End") {
          scroll.latest(smooth)
          return
        }
        const backward =
          event.key === "ArrowUp" ||
          event.key === "PageUp" ||
          (event.key === " " && event.shiftKey)
        const distance = event.key.startsWith("Arrow")
          ? 40
          : list.clientHeight * 0.9
        const top =
          event.key === "Home"
            ? 0
            : Math.max(
                0,
                Math.min(
                  list.scrollTop + distance * (backward ? -1 : 1),
                  list.scrollHeight - list.clientHeight
                )
              )
        const anchor = currentView.current.anchorAt(top)
        if (anchor) scroll.target(anchor.id, smooth, anchor.offset)
      }
    }
    const pointer = () => scroll.interrupt()
    list.addEventListener("pointerdown", pointer)
    list.addEventListener("touchstart", start, { passive: true })
    list.addEventListener("touchmove", move, { passive: true })
    list.addEventListener("wheel", wheel, { passive: true })
    list.addEventListener("keydown", key)
    const resize = new ResizeObserver(() => {
      if (currentView.current.items.length) scroll.layout()
    })
    resize.observe(list)
    resize.observe(body)
    return () => {
      positions.set(roomId, scroll.position())
      // Match the bounded message cache instead of retaining every visited room.
      if (positions.size > 20) {
        const oldest = positions.keys().next().value
        if (oldest !== undefined) positions.delete(oldest)
      }
      resize.disconnect()
      list.removeEventListener("scroll", capture, true)
      list.removeEventListener("pointerdown", pointer)
      list.removeEventListener("touchstart", start)
      list.removeEventListener("touchmove", move)
      list.removeEventListener("wheel", wheel)
      list.removeEventListener("keydown", key)
      controller.current = null
    }
  }, [roomId, active, viewport, content])

  // Observe the committed UI, including outgoing rows, rather than query data.
  useLayoutEffect(() => {
    const list = viewport.current,
      scroll = controller.current
    if (!active || !list || !scroll || (!loaded && !rows.length)) return
    if (followNext.current) {
      scroll.follow()
      followNext.current = false
    }
    const unread = firstUnread
      ? currentView.current.locate(firstUnread.id)
      : null
    scroll.layout(unread === null ? undefined : list.scrollTop + unread)
  }, [rows, active, firstUnread, loaded, view.total, view.revision, viewport])

  useEffect(() => {
    if (status.atBottom && controller.current?.isAtBottom()) markRead()
  }, [markRead, status.atBottom])

  return {
    isTargeting: (id: string) => controller.current?.isTargeting(id) ?? false,
    finishTarget: (id: string) => controller.current?.finishTarget(id),
    arrived: (id: string) => controller.current?.arrived(id) ?? false,
    target: (id: string) =>
      controller.current?.target(
        id,
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) ?? false,
    viewport,
    content,
    view,
    interrupt: () => controller.current?.interrupt(),
    read: () => controller.current?.read(),
    ...status,
    follow: () => {
      followNext.current = true
    },
    latest: () =>
      controller.current?.latest(
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
  }
}
