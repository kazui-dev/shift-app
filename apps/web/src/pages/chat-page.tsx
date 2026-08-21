import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import * as v from "valibot"

import { chatEventSchema } from "@workspace/shared/communications"
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
  const rooms = useQuery({ queryKey: ["chat-rooms"], queryFn: getChatRooms })
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const activeYears = useMemo(
    () => years.data?.years.filter((year) => year.status !== "archived") ?? [],
    [years.data]
  )
  const [roomId, setRoomId] = useState<string | null>(null)
  const selectedRoomId =
    roomId && rooms.data?.rooms.some((room) => room.id === roomId)
      ? roomId
      : (rooms.data?.rooms[0]?.id ?? null)
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
  const [memberId, setMemberId] = useState("")
  const [content, setContent] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedRoomId) return undefined
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
  }, [queryClient, selectedRoomId])

  const createRoom = useMutation({
    mutationFn: (input: { year: number; name: string; memberId: string }) =>
      createChatRoom({
        year: input.year,
        name: input.name,
        targets: [{ targetType: "member", targetId: input.memberId }],
      }),
    onSuccess: async ({ room }) => {
      setName("")
      setMemberId("")
      setRoomId(room.id)
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
      setFeedback(navigator.onLine ? null : "オフライン送信待ちです。")
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
    if (selectedYear !== null && name && memberId) {
      createRoom.mutate({ year: selectedYear, name, memberId })
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
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">連絡先別</p>
        <h1 className="text-xl font-medium">チャット</h1>
      </div>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">ルームを作成</summary>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={handleCreate}
        >
          <select
            className="h-10 rounded-md border bg-background px-2"
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
            className="h-10 rounded-md border bg-background px-3"
            placeholder="ルーム名"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-2"
            required
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
          >
            <option value="">相手を選択</option>
            {targets.data?.targets.map((target) => (
              <option key={target.targetId} value={target.targetId}>
                {target.displayName}
              </option>
            ))}
          </select>
          <Button className="sm:col-span-3" disabled={createRoom.isPending}>
            {createRoom.isPending && <LoaderCircle className="animate-spin" />}
            作成
          </Button>
        </form>
      </details>

      {feedback && <p className="text-sm text-destructive">{feedback}</p>}
      <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
        <div className="space-y-2">
          {rooms.isPending && <LoaderCircle className="animate-spin" />}
          {rooms.data?.rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`w-full rounded-md border p-3 text-left ${selectedRoomId === room.id ? "border-foreground" : ""}`}
              onClick={() => setRoomId(room.id)}
            >
              <span className="font-medium">{room.name}</span>
            </button>
          ))}
          {rooms.data?.rooms.length === 0 && (
            <p className="text-sm text-muted-foreground">
              ルームはありません。
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          {messages.isPending && <LoaderCircle className="animate-spin" />}
          <ul className="max-h-[50svh] space-y-3 overflow-y-auto">
            {messages.data?.messages.map((message) => (
              <li key={message.id} className="border-b pb-2">
                <p className="text-sm font-medium">
                  {message.memberDisplayName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {time(message.createdAt)}
                  </span>
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {message.content}
                </p>
              </li>
            ))}
          </ul>
          {selectedRoomId ? (
            <form className="flex gap-2" onSubmit={handleSend}>
              <input
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3"
                placeholder="メッセージ"
                maxLength={2000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              <Button disabled={send.isPending || !content.trim()}>送信</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              ルームを選択してください。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
