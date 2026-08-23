import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { ArrowLeft, LoaderCircle, Plus, Send, X } from "lucide-react"
import * as v from "valibot"

import {
  chatEventSchema,
  type ChatTargetOption,
} from "@workspace/shared/communications"
import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import {
  createChatRoom,
  getChatMessages,
  getChatRooms,
  getChatTargets,
  sendChatMessage,
} from "@/api/chat"
import { getYears } from "@/api/years"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"
import { useOfflineMode } from "@/components/offline-mode-context"
import { EmptyState } from "@/components/page-layout"

function time(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function ChatPage() {
  const queryClient = useQueryClient()
  const offline = useOfflineMode()
  const rooms = useQuery({ queryKey: ["chat-rooms"], queryFn: getChatRooms })
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const activeYears = useMemo(
    () => years.data?.years.filter((year) => year.status !== "archived") ?? [],
    [years.data]
  )
  const [roomId, setRoomId] = useState<string | null>(null)
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 768px)").matches
  )
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const update = () => setDesktop(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  const selectedRoomId =
    roomId && rooms.data?.rooms.some((room) => room.id === roomId)
      ? roomId
      : desktop
        ? (rooms.data?.rooms[0]?.id ?? null)
        : null
  const selectedRoom = rooms.data?.rooms.find(
    (room) => room.id === selectedRoomId
  )
  const messages = useQuery({
    queryKey: ["chat-messages", selectedRoomId],
    queryFn:
      selectedRoomId === null
        ? skipToken
        : () => getChatMessages(selectedRoomId),
  })

  const [year, setYear] = useState<number | null>(null)
  const selectedYear = year ?? activeYears[0]?.year ?? null
  const targets = useQuery({
    queryKey: ["chat-targets", selectedYear],
    queryFn:
      selectedYear === null ? skipToken : () => getChatTargets(selectedYear),
  })
  const [name, setName] = useState("")
  const [targetKey, setTargetKey] = useState("")
  const [content, setContent] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedRoomId || offline) return undefined
    let socket: WebSocket | null = null
    let retry: number | null = null
    let disposed = false
    const connect = () => {
      const url = new URL(
        `/api/chat/rooms/${encodeURIComponent(selectedRoomId)}/ws`,
        window.location.href
      )
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      socket = new WebSocket(url)
      socket.addEventListener("message", (event) => {
        try {
          const parsed = v.safeParse(
            chatEventSchema,
            JSON.parse(String(event.data))
          )
          if (parsed.success) {
            void queryClient.invalidateQueries({
              queryKey: ["chat-messages", selectedRoomId],
            })
            void queryClient.invalidateQueries({ queryKey: ["chat-rooms"] })
          }
        } catch {
          // Ignore malformed server events and wait for the next valid event.
        }
      })
      socket.addEventListener("close", () => {
        if (!disposed) retry = window.setTimeout(connect, 2_000)
      })
    }
    connect()
    return () => {
      disposed = true
      if (retry !== null) window.clearTimeout(retry)
      socket?.close(1000, "Room changed")
    }
  }, [offline, queryClient, selectedRoomId])

  const createRoom = useMutation({
    mutationFn: (input: {
      year: number
      name: string
      target: ChatTargetOption
    }) =>
      createChatRoom({
        year: input.year,
        name: input.name,
        targets: [
          {
            targetType: input.target.targetType,
            targetId: input.target.targetId,
          },
        ],
      }),
    onSuccess: async ({ room }) => {
      setName("")
      setTargetKey("")
      setRoomId(room.id)
      setCreateOpen(false)
      setFeedback(null)
      await queryClient.invalidateQueries({ queryKey: ["chat-rooms"] })
    },
    onError: (error) => setFeedback(errorMessage(error)),
  })

  const send = useMutation({
    mutationKey: ["send-chat-message"],
    mutationFn: (variables: { roomId: string; id: string; content: string }) =>
      sendChatMessage(variables.roomId, variables),
    onMutate: () => {
      setContent("")
      setFeedback(offline ? "オフライン送信待ちです。" : null)
    },
    onSuccess: async () => {
      setContent("")
      setFeedback(null)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-messages", selectedRoomId],
        }),
        queryClient.invalidateQueries({ queryKey: ["chat-rooms"] }),
      ])
    },
    onError: (error) => setFeedback(errorMessage(error)),
  })

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const target = targets.data?.targets.find(
      (item) => `${item.targetType}:${item.targetId}` === targetKey
    )
    if (selectedYear !== null && name && target) {
      createRoom.mutate({ year: selectedYear, name, target })
    }
  }

  function handleSend(event: FormEvent) {
    event.preventDefault()
    const message = content.trim()
    if (selectedRoomId && message) {
      send.mutate({
        roomId: selectedRoomId,
        id: crypto.randomUUID(),
        content: message,
      })
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-5xl flex-col md:min-h-[70dvh]">
      <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_minmax(0,1fr)] md:border-y">
        <aside
          className={`${selectedRoomId === null ? "flex" : "hidden"} min-h-0 flex-col md:flex md:border-r`}
        >
          <header className="flex min-h-12 items-center justify-between border-b">
            <h1 className="text-xl font-semibold tracking-tight">連絡</h1>
            {!offline && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="ルームを作成"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
              </Button>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="divide-y">
              {rooms.data?.rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    className={`flex min-h-14 w-full items-center px-1 text-left text-sm transition-colors md:px-3 ${selectedRoomId === room.id ? "font-medium text-foreground md:bg-muted/60" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setRoomId(room.id)}
                  >
                    <span className="truncate">{room.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            {rooms.data?.rooms.length === 0 && (
              <EmptyState>連絡はありません</EmptyState>
            )}
            {offline && !rooms.data && (
              <EmptyState>保存された連絡はありません</EmptyState>
            )}
          </div>
        </aside>

        <div
          className={`${selectedRoomId === null ? "hidden" : "flex"} min-h-0 flex-col md:flex`}
        >
          <header className="flex min-h-12 items-center gap-2 border-b md:px-4">
            <Button
              className="md:hidden"
              size="icon-sm"
              variant="ghost"
              aria-label="連絡一覧に戻る"
              onClick={() => setRoomId(null)}
            >
              <ArrowLeft />
            </Button>
            <h2 className="min-w-0 truncate font-semibold">
              {selectedRoom?.name ?? "連絡"}
            </h2>
          </header>
          <ul className="min-h-0 flex-1 overflow-y-auto px-1 md:px-4">
            {messages.data?.messages.map((message, index) => {
              const previous = messages.data.messages[index - 1]
              const grouped =
                previous?.memberDisplayName === message.memberDisplayName
              return (
                <li key={message.id} className={grouped ? "pt-1" : "pt-5"}>
                  {!grouped && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {message.memberDisplayName}
                      <span className="ml-2 font-normal">
                        {time(message.createdAt)}
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </li>
              )
            })}
          </ul>
          {selectedRoomId && (
            <form
              className="flex gap-2 border-t bg-background py-3 md:px-4"
              onSubmit={handleSend}
            >
              <input
                className={`${fieldClassName} min-w-0 flex-1 rounded-full px-4`}
                placeholder="メッセージ"
                maxLength={2000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              <Button
                size="icon-lg"
                className="rounded-full"
                disabled={send.isPending || !content.trim()}
                aria-label="送信"
              >
                {send.isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Send />
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      {createOpen && !offline && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 md:items-center md:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="閉じる"
            onClick={() => setCreateOpen(false)}
          />
          <section
            className="relative z-10 w-full rounded-t-2xl bg-background px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-2xl md:border md:p-6"
            aria-label="ルームを作成"
          >
            <header className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">ルームを作成</h2>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="閉じる"
                onClick={() => setCreateOpen(false)}
              >
                <X />
              </Button>
            </header>
            <form className="grid gap-3" onSubmit={handleCreate}>
              <select
                aria-label="年度"
                className={fieldClassName}
                value={selectedYear ?? ""}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {activeYears.map((item) => (
                  <option key={item.year} value={item.year}>
                    {item.year}
                  </option>
                ))}
              </select>
              <input
                className={fieldClassName}
                placeholder="ルーム名"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <select
                className={fieldClassName}
                required
                value={targetKey}
                onChange={(event) => setTargetKey(event.target.value)}
              >
                <option value="">宛先を選択</option>
                {(["member", "role", "activity"] as const).map((type) => {
                  const options = targets.data?.targets.filter(
                    (target) => target.targetType === type
                  )
                  if (!options?.length) return null
                  const label =
                    type === "member"
                      ? "メンバー"
                      : type === "role"
                        ? "役割"
                        : "活動"
                  return (
                    <optgroup key={type} label={label}>
                      {options.map((target) => (
                        <option
                          key={`${target.targetType}:${target.targetId}`}
                          value={`${target.targetType}:${target.targetId}`}
                        >
                          {target.displayName}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
              <Button disabled={createRoom.isPending}>
                {createRoom.isPending && (
                  <LoaderCircle className="animate-spin" />
                )}
                作成
              </Button>
            </form>
          </section>
        </div>
      )}
      {feedback && (
        <FeedbackNotice
          message={feedback}
          onDismiss={() => setFeedback(null)}
        />
      )}
    </section>
  )
}
