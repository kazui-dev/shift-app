import { CreateChat } from "@/components/chat/create-chat"
import { roomSchedule } from "@/components/chat/room-schedule"
import { RoomList } from "@/components/chat/room-list"
import { Textarea } from "@workspace/ui/components/textarea"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { leaveChatRoom } from "@/api/chat"
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
import { ChevronLeft, LoaderCircle, MoreHorizontal, Send } from "lucide-react"
import * as v from "valibot"

import { chatEventSchema } from "@workspace/shared/communications"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import {
  getChatMessages,
  getChatRooms,
  sendChatMessage,
  updateChatPreferences,
} from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useOfflineMode } from "@/components/offline-mode-context"
import { EmptyState } from "@/components/page-layout"
import { ResponsiveDialog } from "@/components/responsive-overlay"

function time(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
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
  const [actionsOpen, setActionsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const rooms = useQuery({
    queryKey: ["chat-rooms", selectedYear, false],
    queryFn:
      selectedYear === null ? skipToken : () => getChatRooms(selectedYear),
  })
  const [roomId, setRoomId] = useState<string | null>(search.room ?? null)
  const closedRooms = useQuery({
    queryKey: ["chat-rooms", selectedYear, true],
    queryFn:
      selectedYear === null
        ? skipToken
        : () => getChatRooms(selectedYear, true),
    enabled:
      closed ||
      (rooms.isSuccess &&
        roomId !== null &&
        !rooms.data.rooms.some((room) => room.id === roomId)),
  })
  const allRooms = [
    ...(rooms.data?.rooms ?? []),
    ...(closedRooms.data?.rooms ?? []),
  ]
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
    roomId && allRooms.some((room) => room.id === roomId)
      ? roomId
      : desktop
        ? (rooms.data?.rooms[0]?.id ?? null)
        : null
  const selectedRoom = allRooms.find((room) => room.id === selectedRoomId)
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

  const send = useMutation({
    mutationKey: ["send-chat-message"],
    mutationFn: (variables: { roomId: string; id: string; content: string }) =>
      sendChatMessage(variables.roomId, variables),
    onMutate: () => {
      setContent("")
      if (offline) toast.info("オフライン送信待ちです。")
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-messages", selectedRoomId],
        }),
        queryClient.invalidateQueries({ queryKey: ["chat-rooms"] }),
      ])
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

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
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
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
      <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          aria-label="ルーム一覧"
          className={`${selectedRoomId === null ? "flex" : "hidden"} min-h-0 min-w-0 flex-col md:flex md:pr-3`}
        >
          <RoomList
            rooms={rooms.data?.rooms ?? []}
            closedRooms={closedRooms.data?.rooms ?? []}
            expanded={closed}
            loadingClosed={closedRooms.isPending}
            closedError={closedRooms.isError}
            selectedId={selectedRoomId}
            offline={offline}
            onSelect={setRoomId}
            onExpand={() => setClosed((value) => !value)}
            onCreate={() => setCreateOpen(true)}
          />
          {offline && !rooms.data && (
            <EmptyState>保存されたチャットはありません</EmptyState>
          )}
        </aside>
        <div
          className={`${selectedRoomId === null ? "hidden" : "flex"} min-h-0 min-w-0 flex-col md:flex md:border-l`}
        >
          {selectedRoom ? (
            <header className="flex min-h-14 shrink-0 items-center gap-2 border-b pb-2 md:px-5">
              <Button
                size="icon-sm"
                variant="ghost"
                className="md:hidden"
                aria-label="チャット一覧に戻る"
                onClick={() => setRoomId(null)}
              >
                <ChevronLeft />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold">
                  {selectedRoom.name}
                </h1>
                {roomSchedule(selectedRoom) && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {roomSchedule(selectedRoom)}
                  </p>
                )}
              </div>
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
                size="icon-sm"
                aria-label="ルームの操作"
                onClick={() => setActionsOpen(true)}
              >
                <MoreHorizontal />
              </Button>
            </header>
          ) : (
            <EmptyState>ルームを選んでください</EmptyState>
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
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-5 md:px-6"
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
                previous?.memberId === message.memberId &&
                Date.parse(message.createdAt) - Date.parse(previous.createdAt) <
                  300_000 &&
                new Date(previous.createdAt).toLocaleDateString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                }) ===
                  new Date(message.createdAt).toLocaleDateString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })
              return (
                <li
                  key={message.id}
                  data-sequence={message.sequence}
                  className={`${grouped ? "pt-1" : "pt-6"} max-w-[80ch] break-words`}
                >
                  {(!previous ||
                    new Date(previous.createdAt).toLocaleDateString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    }) !==
                      new Date(message.createdAt).toLocaleDateString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })) && (
                    <p className="mb-5 text-center text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      }).format(new Date(message.createdAt))}
                    </p>
                  )}
                  {!grouped && (
                    <p className="flex items-baseline gap-2 text-sm font-medium">
                      {message.memberDisplayName}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {time(message.createdAt)}
                      </span>
                    </p>
                  )}
                  <p className="mt-0.5 text-sm leading-7 whitespace-pre-wrap">
                    {message.content}
                  </p>
                </li>
              )
            })}
          </ul>
          {selectedRoomId && selectedRoom?.canPost && (
            <form
              className="flex shrink-0 items-end gap-2 bg-background pt-3 md:px-5"
              onSubmit={handleSend}
            >
              <Textarea
                aria-label="メッセージ"
                rows={1}
                className="max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-xl px-3 py-2.5"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    desktop
                  ) {
                    event.preventDefault()
                    if (!send.isPending)
                      event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder="メッセージ"
                maxLength={2000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              <Button
                size="icon-lg"
                className="rounded-xl"
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

      {actionsOpen && selectedRoom && (
        <ResponsiveDialog
          open
          title="ルームの操作"
          onOpenChange={setActionsOpen}
        >
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              disabled={offline}
              onClick={() =>
                void updateChatPreferences(selectedRoom.id, {
                  muted: !selectedRoom.muted,
                })
                  .then(() => {
                    setActionsOpen(false)
                    return queryClient.invalidateQueries({
                      queryKey: ["chat-rooms"],
                    })
                  })
                  .catch((error) => toast.error(errorMessage(error)))
              }
            >
              {selectedRoom.muted ? "ミュート解除" : "ミュート"}
            </Button>
            {selectedRoom.canManage && (
              <Button
                variant="ghost"
                disabled={offline}
                onClick={() => {
                  setActionsOpen(false)
                  setSettingsOpen(true)
                }}
              >
                ルーム設定
              </Button>
            )}
            {selectedRoom.kind === "custom" && !selectedRoom.historical && (
              <Button
                variant="ghost"
                disabled={offline}
                className="text-destructive"
                onClick={() => {
                  setActionsOpen(false)
                  setLeaving(true)
                }}
              >
                退出
              </Button>
            )}
            {!selectedRoom.canPost && (
              <p className="text-center text-xs text-muted-foreground">
                このルームは閲覧のみです
              </p>
            )}
          </div>
        </ResponsiveDialog>
      )}
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
      {createOpen && !offline && selectedYear !== null && (
        <CreateChat
          year={selectedYear}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setRoomId(id)
            setCreateOpen(false)
          }}
        />
      )}
    </section>
  )
}
