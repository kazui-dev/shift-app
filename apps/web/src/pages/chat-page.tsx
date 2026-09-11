import { ConfirmDialog } from "@/components/confirm-dialog"
import { leaveChatRoom } from "@/api/chat"
import { DisplayYearNotice } from "@/components/display-year-notice"
import { getRouteApi } from "@tanstack/react-router"
import { ShiftAttendance } from "@/components/shifts/shift-attendance"
import { ChatSettings } from "@/components/chat-settings"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  skipToken,
  useMutation,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { ChevronLeft, LoaderCircle, Plus, Send } from "lucide-react"
import * as v from "valibot"

import {
  chatEventSchema,
  type ChatTargetOption,
} from "@workspace/shared/communications"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import {
  createChatRoom,
  getChatMessages,
  getChatRooms,
  getChatTargets,
  sendChatMessage,
  updateChatPreferences,
} from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useOfflineMode } from "@/components/offline-mode-context"
import { EmptyState, PageHeader } from "@/components/page-layout"
import { ResponsiveDialog } from "@/components/responsive-overlay"

function time(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function ChatPage() {
  const search = getRouteApi("/_app/chat").useSearch()
  const [attendanceOpen, setAttendanceOpen] = useState(!!search.report)
  const queryClient = useQueryClient()
  const offline = useOfflineMode()
  const [leaving, setLeaving] = useState(false)
  const displayYear = useDisplayYear()
  const selectedYear = displayYear.year
  const [closed, setClosed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const rooms = useQuery({
    queryKey: ["chat-rooms", selectedYear, closed],
    queryFn:
      selectedYear === null
        ? skipToken
        : () => getChatRooms(selectedYear, closed),
  })
  const [roomId, setRoomId] = useState<string | null>(search.room ?? null)
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
  const scrollRef = useRef<HTMLUListElement>(null)
  const stickToBottom = useRef(true)
  const initializedRoom = useRef<string | null>(null)
  const previousHeight = useRef<number | null>(null)
  const messages = useInfiniteQuery({
    queryKey: ["chat-messages", selectedRoomId],
    queryFn:
      selectedRoomId === null
        ? skipToken
        : ({ pageParam }) => getChatMessages(selectedRoomId, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) =>
      last.hasMore ? last.messages[0]?.sequence : undefined,
  })

  const messageList = useMemo(
    () =>
      messages.data?.pages.toReversed().flatMap((page) => page.messages) ?? [],
    [messages.data]
  )
  useEffect(() => {
    const list = scrollRef.current
    const sequence = messageList.at(-1)?.sequence
    if (!list || !selectedRoom || !sequence) return
    if (initializedRoom.current !== selectedRoom.id) {
      initializedRoom.current = selectedRoom.id
      const unread = list.querySelector(
        `[data-sequence="${selectedRoom.lastRead + 1}"]`
      )
      if (unread instanceof HTMLElement && selectedRoom.lastRead > 0) {
        list.scrollTop = unread.offsetTop - list.offsetTop
        stickToBottom.current = false
      } else {
        list.scrollTop = list.scrollHeight
        stickToBottom.current = true
      }
    } else if (previousHeight.current !== null) {
      list.scrollTop += list.scrollHeight - previousHeight.current
      previousHeight.current = null
    } else if (stickToBottom.current) list.scrollTop = list.scrollHeight
    if (
      stickToBottom.current &&
      !offline &&
      document.visibilityState === "visible" &&
      sequence > selectedRoom.lastRead
    )
      void updateChatPreferences(selectedRoom.id, { lastRead: sequence })
        .then(() => queryClient.invalidateQueries({ queryKey: ["chat-rooms"] }))
        .catch(() => undefined)
  }, [messageList, selectedRoom, offline, queryClient])
  const targets = useQuery({
    queryKey: ["chat-targets", selectedYear],
    queryFn:
      selectedYear === null ? skipToken : () => getChatTargets(selectedYear),
  })
  const [name, setName] = useState("")
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [content, setContent] = useState("")

  useEffect(() => {
    if (!selectedRoomId || offline || selectedRoom?.historical) return undefined
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
  }, [offline, queryClient, selectedRoomId, selectedRoom?.historical])

  const createRoom = useMutation({
    mutationFn: (input: {
      year: number
      name: string
      targets: ChatTargetOption[]
    }) =>
      createChatRoom({
        year: input.year,
        name: input.name,
        targets: input.targets.map((target) => ({
          targetType: target.targetType,
          targetId: target.targetId,
        })),
      }),
    onSuccess: async ({ room }) => {
      setName("")
      setTargetKeys([])
      setRoomId(room.id)
      setCreateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["chat-rooms"] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const send = useMutation({
    mutationKey: ["send-chat-message"],
    mutationFn: (variables: { roomId: string; id: string; content: string }) =>
      sendChatMessage(variables.roomId, variables),
    onMutate: () => {
      setContent("")
      if (offline) toast.info("オフライン送信待ちです。")
    },
    onSuccess: async () => {
      setContent("")
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-messages", selectedRoomId],
        }),
        queryClient.invalidateQueries({ queryKey: ["chat-rooms"] }),
      ])
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const selectedTargets =
      targets.data?.targets.filter((item) =>
        targetKeys.includes(`${item.targetType}:${item.targetId}`)
      ) ?? []
    if (selectedYear !== null && name && selectedTargets.length)
      createRoom.mutate({ year: selectedYear, name, targets: selectedTargets })
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
    <section className="flex min-h-[calc(100dvh-9rem)] w-full min-w-0 flex-col gap-6 md:min-h-[70dvh]">
      {leaving && selectedRoom && (
        <ConfirmDialog
          title="ルームから退出しますか"
          description="退出後も、退出するまでの履歴は確認できます。"
          confirmLabel="退出"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false)
            void leaveChatRoom(selectedRoom.id)
              .then(() =>
                queryClient.invalidateQueries({ queryKey: ["chat-rooms"] })
              )
              .catch((error) => toast.error(errorMessage(error)))
          }}
        />
      )}
      <PageHeader
        className="md:hidden"
        title={selectedRoom?.name ?? "チャット"}
        back={
          selectedRoomId !== null ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="チャット一覧に戻る"
              onClick={() => setRoomId(null)}
            >
              <ChevronLeft />
            </Button>
          ) : undefined
        }
      >
        <DisplayYearNotice />
        {selectedRoomId === null && !offline && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="ルームを作成"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
          </Button>
        )}
      </PageHeader>
      <PageHeader className="hidden md:flex" title="チャット">
        <DisplayYearNotice />
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
      </PageHeader>
      <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_minmax(0,1fr)] md:border-y">
        <aside
          className={`${selectedRoomId === null ? "flex" : "hidden"} min-h-0 flex-col md:flex md:border-r`}
        >
          <Button variant="ghost" size="sm" onClick={() => setClosed(!closed)}>
            {closed ? "ルーム一覧" : "閉じたルーム"}
          </Button>
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
                    {room.unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-foreground px-1.5 text-xs text-background">
                        {room.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {rooms.data?.rooms.length === 0 && (
              <EmptyState>チャットはありません</EmptyState>
            )}
            {offline && !rooms.data && (
              <EmptyState>保存されたチャットはありません</EmptyState>
            )}
          </div>
        </aside>

        <div
          className={`${selectedRoomId === null ? "hidden" : "flex"} min-h-0 flex-col md:flex`}
        >
          <header className="hidden min-h-12 items-center gap-2 border-b px-4 md:flex">
            <h2 className="min-w-0 truncate font-semibold">
              {selectedRoom?.name ?? "チャット"}
            </h2>
          </header>
          {selectedRoom && (
            <div className="flex items-center justify-end gap-1 border-b py-1">
              {selectedRoom.activityId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttendanceOpen(true)}
                >
                  出勤・連絡
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void updateChatPreferences(selectedRoom.id, {
                    muted: !selectedRoom.muted,
                  })
                    .then(() =>
                      queryClient.invalidateQueries({
                        queryKey: ["chat-rooms"],
                      })
                    )
                    .catch((error) => toast.error(errorMessage(error)))
                }
              >
                {selectedRoom.muted ? "ミュート解除" : "ミュート"}
              </Button>
              {selectedRoom.canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                >
                  設定
                </Button>
              )}
              {selectedRoom.kind === "custom" && !selectedRoom.historical && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLeaving(true)}
                >
                  退出
                </Button>
              )}
              {!selectedRoom.canPost && (
                <span className="px-2 text-xs text-muted-foreground">
                  閲覧のみ
                </span>
              )}
            </div>
          )}
          <ul
            ref={scrollRef}
            onScroll={(event) => {
              const el = event.currentTarget
              stickToBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 48
              const sequence = messageList.at(-1)?.sequence
              if (
                stickToBottom.current &&
                selectedRoom &&
                sequence &&
                sequence > selectedRoom.lastRead &&
                !offline
              )
                void updateChatPreferences(selectedRoom.id, {
                  lastRead: sequence,
                })
                  .then(() =>
                    queryClient.invalidateQueries({ queryKey: ["chat-rooms"] })
                  )
                  .catch(() => undefined)
            }}
            className="max-h-[65dvh] min-h-0 flex-1 overflow-y-auto px-1 md:px-4"
          >
            {messages.hasNextPage && (
              <li className="py-2 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={messages.isFetchingNextPage}
                  onClick={() => {
                    previousHeight.current =
                      scrollRef.current?.scrollHeight ?? null
                    void messages.fetchNextPage()
                  }}
                >
                  以前のメッセージ
                </Button>
              </li>
            )}
            {messageList.map((message, index) => {
              const previous = messageList[index - 1]
              const grouped =
                previous?.memberDisplayName === message.memberDisplayName
              return (
                <li
                  key={message.id}
                  data-sequence={message.sequence}
                  className={grouped ? "pt-1" : "pt-5"}
                >
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
          {selectedRoomId && selectedRoom?.canPost && (
            <form
              className="flex gap-2 border-t bg-background py-3 md:px-4"
              onSubmit={handleSend}
            >
              <Input
                className="h-11 min-w-0 flex-1 rounded-full px-4"
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

      {attendanceOpen && selectedRoom?.activityId && (
        <ShiftAttendance
          activityId={selectedRoom.activityId}
          selectedAssignment={search.report}
          onClose={() => setAttendanceOpen(false)}
        />
      )}
      {settingsOpen && selectedRoom && (
        <ChatSettings
          id={selectedRoom.id}
          year={selectedRoom.year}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {createOpen && !offline && (
        <ResponsiveDialog
          open
          title="ルームを作成"
          onOpenChange={(open) => {
            if (!open) setCreateOpen(false)
          }}
        >
          <form className="grid gap-3" onSubmit={handleCreate}>
            <Input
              className="h-11"
              placeholder="ルーム名"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <fieldset className="max-h-64 overflow-auto">
              <legend className="text-sm">宛先</legend>
              {targets.data?.targets.map((target) => {
                const key = `${target.targetType}:${target.targetId}`
                return (
                  <label
                    key={key}
                    className="flex min-h-10 items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={targetKeys.includes(key)}
                      onChange={(e) =>
                        setTargetKeys((keys) =>
                          e.target.checked
                            ? [...keys, key]
                            : keys.filter((item) => item !== key)
                        )
                      }
                    />
                    {target.displayName}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {target.targetType === "member"
                        ? "メンバー"
                        : target.targetType === "role"
                          ? "ロール"
                          : "シフト"}
                    </span>
                  </label>
                )
              })}
            </fieldset>
            <Button disabled={createRoom.isPending}>
              {createRoom.isPending && (
                <LoaderCircle className="animate-spin" />
              )}
              作成
            </Button>
          </form>
        </ResponsiveDialog>
      )}
    </section>
  )
}
