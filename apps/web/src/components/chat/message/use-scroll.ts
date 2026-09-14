import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  MessageScroll,
  type ScrollPosition,
  type ScrollStatus,
} from "@/components/chat/message/scroll"
import { unreadMessage, type MessageRow } from "@/components/chat/message/list"

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
  const viewport = useRef<HTMLElement>(null)
  const content = useRef<HTMLDivElement>(null)
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
    const offset = (element: Element) =>
      element.getBoundingClientRect().top - list.getBoundingClientRect().top
    const scroll = new MessageScroll(
      {
        top: () => list.scrollTop,
        height: () => list.clientHeight,
        extent: () => list.scrollHeight,
        move: (top, smooth) =>
          list.scrollTo({ top, behavior: smooth ? "smooth" : "instant" }),
        anchor: () => {
          const top = list.getBoundingClientRect().top
          for (const row of body.querySelectorAll<HTMLElement>(
            "[data-message-id]"
          )) {
            if (
              row.getBoundingClientRect().bottom > top &&
              row.dataset.messageId
            )
              return { id: row.dataset.messageId, offset: offset(row) }
          }
          return null
        },
        locate: (id) => {
          const row = body.querySelector(
            `[data-message-id="${CSS.escape(id)}"]`
          )
          return row ? offset(row) : null
        },
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
      if (
        event.target === list &&
        [
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown",
          " ",
        ].includes(event.key)
      )
        scroll.read()
    }
    list.addEventListener("touchstart", start, { passive: true })
    list.addEventListener("touchmove", move, { passive: true })
    list.addEventListener("wheel", wheel, { passive: true })
    list.addEventListener("keydown", key)
    const resize = new ResizeObserver(() => {
      if (body.querySelector("[data-message-id]")) scroll.layout()
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
      list.removeEventListener("touchstart", start)
      list.removeEventListener("touchmove", move)
      list.removeEventListener("wheel", wheel)
      list.removeEventListener("keydown", key)
      controller.current = null
    }
  }, [roomId, active])

  // Observe the committed UI, including outgoing rows, rather than query data.
  useLayoutEffect(() => {
    const list = viewport.current,
      scroll = controller.current
    if (!active || !list || !scroll || (!loaded && !rows.length)) return
    if (followNext.current) {
      scroll.follow()
      followNext.current = false
    }
    const firstUnread = unreadMessage(rows, initialRead, memberId)
    const unread = firstUnread
      ? list.querySelector(`[data-message-id="${CSS.escape(firstUnread.id)}"]`)
      : null
    scroll.layout(
      unread
        ? list.scrollTop +
            unread.getBoundingClientRect().top -
            list.getBoundingClientRect().top
        : undefined
    )
  }, [rows, active, initialRead, memberId, loaded])

  useEffect(() => {
    if (controller.current?.isAtBottom()) markRead()
  }, [markRead, status.atBottom])

  return {
    arrived: (id: string) => controller.current?.arrived(id) ?? false,
    target: (id: string) =>
      controller.current?.target(
        id,
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) ?? false,
    viewport,
    content,
    ...status,
    onScroll: () => controller.current?.scroll(),
    follow: () => {
      followNext.current = true
    },
    latest: () =>
      controller.current?.latest(
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
  }
}
