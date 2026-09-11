import { receiveMessage, updateRoom } from "@/data/chat-cache"
import { messagesQuery, membersQuery } from "@/data/chat"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import * as v from "valibot"
import { chatEventSchema } from "@workspace/shared/communications"
import { updateChatPreferences, type getChatRoom } from "@/api/chat"

type Room = Awaited<ReturnType<typeof getChatRoom>>["room"]
const positions = new Map<string, number>()
export function useMessages(room: Room, offline: boolean, active: boolean) {
  const client = useQueryClient(),
    viewport = useRef<HTMLDivElement>(null),
    sticky = useRef(true),
    initialized = useRef(false),
    previousHeight = useRef<number | null>(null),
    [atBottom, setAtBottom] = useState(true)
  const initialRead = useRef(room.lastRead),
    readSequence = useRef(room.lastRead)
  const query = useInfiniteQuery({
    ...messagesQuery(room.id),
    enabled: !offline && active,
  })
  const messages = useMemo(
    () => query.data?.pages.toReversed().flatMap((page) => page.messages) ?? [],
    [query.data]
  )
  const markRead = useCallback(() => {
    const sequence = messages.at(-1)?.sequence
    if (
      sequence &&
      !offline &&
      active &&
      !room.historical &&
      document.visibilityState === "visible" &&
      sequence > readSequence.current
    ) {
      readSequence.current = sequence
      void updateChatPreferences(room.id, { lastRead: sequence })
        .then(() => {
          updateRoom(client, room.id, (current) => ({
            ...current,
            lastRead: Math.max(current.lastRead, sequence),
            unreadCount: Math.max(
              0,
              current.lastSequence - Math.max(current.lastRead, sequence)
            ),
          }))
        })
        .catch(() => {
          readSequence.current = room.lastRead
        })
    }
  }, [
    messages,
    offline,
    active,
    room.historical,
    room.id,
    room.lastRead,
    client,
  ])
  useLayoutEffect(() => {
    const list = viewport.current
    if (!active || !list || !messages.length) return
    if (!initialized.current) {
      initialized.current = true
      const saved = positions.get(room.id),
        unread = list.querySelector(
          `[data-sequence="${initialRead.current + 1}"]`
        )
      if (saved !== undefined) list.scrollTop = saved
      else if (initialRead.current > 0 && unread instanceof HTMLElement)
        list.scrollTop = unread.offsetTop
      else list.scrollTop = list.scrollHeight
      sticky.current =
        list.scrollHeight - list.scrollTop - list.clientHeight < 48
    } else if (previousHeight.current !== null) {
      list.scrollTop += list.scrollHeight - previousHeight.current
      previousHeight.current = null
    } else if (sticky.current) list.scrollTop = list.scrollHeight
    setAtBottom(sticky.current)
  }, [messages, room.id, active])
  useLayoutEffect(() => {
    const list = viewport.current
    if (!active || !list) return undefined
    const resize = new ResizeObserver(() => {
      if (sticky.current) list.scrollTop = list.scrollHeight
    })
    resize.observe(list)
    return () => resize.disconnect()
  }, [active])
  useEffect(() => {
    if (atBottom) markRead()
  }, [markRead, atBottom])
  useEffect(() => {
    if (!active || offline || room.historical) return undefined
    let socket: WebSocket | null = null,
      timer: number | null = null,
      disposed = false,
      attempts = 0
    const connect = () => {
      const url = new URL(
        `/api/chat/rooms/${encodeURIComponent(room.id)}/ws`,
        window.location.href
      )
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      socket = new WebSocket(url)
      socket.addEventListener("open", () => {
        attempts = 0
        void client.invalidateQueries({ queryKey: ["chat-messages", room.id] })
      })
      socket.addEventListener("message", (event) => {
        try {
          const parsed = v.safeParse(
            chatEventSchema,
            JSON.parse(String(event.data))
          )
          if (parsed.success) {
            const message = parsed.output.message
            const known = client
              .getQueryData(messagesQuery(room.id).queryKey)
              ?.pages.flatMap((page) => page.messages)
              .find((item) => item.memberId === message.memberId)
            const profile = client
              .getQueryData(membersQuery(room.id).queryKey)
              ?.members.find((item) => item.id === message.memberId)
            if (
              (!known && !profile) ||
              !receiveMessage(client, room.id, {
                ...message,
                memberImage: known?.memberImage ?? profile?.image ?? null,
              })
            )
              void client.invalidateQueries({
                queryKey: ["chat-messages", room.id],
              })
          }
        } catch {
          /* Ignore invalid events. */
        }
      })
      socket.addEventListener("close", () => {
        if (!disposed) {
          void client.invalidateQueries({ queryKey: ["chat-room", room.id] })
          timer = window.setTimeout(
            connect,
            Math.min(30_000, 2000 * 2 ** attempts++)
          )
        }
      })
    }
    connect()
    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      socket?.close(1000, "Room changed")
    }
  }, [client, offline, active, room.id, room.historical])
  return {
    viewport,
    messages,
    initialRead: initialRead.current,
    query,
    atBottom,
    onScroll: () => {
      const list = viewport.current
      if (!list) return
      sticky.current =
        list.scrollHeight - list.scrollTop - list.clientHeight < 48
      positions.set(room.id, list.scrollTop)
      setAtBottom(sticky.current)
      if (sticky.current) markRead()
    },
    latest: () => {
      const list = viewport.current
      if (list) {
        sticky.current = true
        list.scrollTop = list.scrollHeight
        setAtBottom(true)
        markRead()
      }
    },
    older: () => {
      previousHeight.current = viewport.current?.scrollHeight ?? null
      void query.fetchNextPage()
    },
  }
}
