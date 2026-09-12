import { useMessageScroll } from "./use-message-scroll"
import { attendanceQuery } from "@/data/attendance"
import { changeRoomMute } from "@/data/preferences"
import { roomQuery, settingsQuery, membersQuery } from "@/data/chat"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDown,
  Bell,
  BellOff,
  ChevronLeft,
  LogOut,
  MoreHorizontal,
  Settings,
  Users,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
import { getChatRoom, leaveChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { useOfflineMode } from "../offline-mode-context"
import { ChatSettings } from "../chat-settings"
import { ShiftAttendance } from "../shifts/shift-attendance"
import { ConfirmDialog } from "../confirm-dialog"
import { ChatComposer } from "./composer"
import { useChatStore } from "./use-chat-store"
import { useMessages } from "./use-messages"
import { MessageImages, LocalImage } from "./images"
import { RoomInfo } from "./room-info"
import { MemberAvatar } from "../member-avatar"
import { messageRows } from "./message-list"
import { roomSchedule } from "./room-schedule"
import { chatImageLimits } from "@workspace/shared/communications"
import { imageSize } from "./image-size"

type Room = Awaited<ReturnType<typeof getChatRoom>>["room"]
function date(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}
function time(value: string) {
  return new Date(value).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  })
}
export function ChatConversation({
  roomId,
  name,
  report,
  active,
  onBack,
}: {
  active: boolean
  onBack: () => void
  roomId: string
  name?: string | undefined
  report?: string | undefined
}) {
  const offline = useOfflineMode(),
    query = useQuery({
      ...roomQuery(roomId),
      enabled: !offline && active,
    })
  if (!query.data)
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 pb-2 md:px-4">
          <Link
            to="/chat"
            onClick={(event) => {
              event.preventDefault()
              onBack()
            }}
            className="md:hidden"
            aria-label="チャット一覧へ"
          >
            <ChevronLeft />
          </Link>
          <span className="truncate text-sm font-semibold">{name}</span>
        </div>
        {query.isError && (
          <div className="px-5 py-4">
            <Button variant="ghost" onClick={() => void query.refetch()}>
              再試行
            </Button>
          </div>
        )}
        {query.isLoading && (
          <output className="px-5 text-sm text-muted-foreground">
            <span className="sr-only">会話を取得しています</span>
          </output>
        )}
      </div>
    )
  return (
    <Conversation
      room={query.data.room}
      offline={offline}
      report={report}
      active={active}
      onBack={onBack}
    />
  )
}
function Conversation({
  room,
  offline,
  report,
  active,
  onBack,
}: {
  room: Room
  active: boolean
  onBack: () => void
  offline: boolean
  report?: string | undefined
}) {
  const client = useQueryClient(),
    navigate = useNavigate(),
    [settings, setSettings] = useState(false),
    [info, setInfo] = useState(false),
    [attendance, setAttendance] = useState(false),
    [leaving, setLeaving] = useState(false)
  const { store, member, ready, queue } = useChatStore(),
    draft = store.draft(room.id)
  const history = useMessages(room, offline, active),
    seat = useRef<HTMLDivElement>(null),
    layout = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!report || !room.activityId) return undefined
    let current = true
    void client
      .ensureQueryData(attendanceQuery(room.activityId))
      .then(() => {
        if (current) setAttendance(true)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [report, client, room.activityId])
  function openAttendance() {
    if (room.activityId)
      void client
        .ensureQueryData(attendanceQuery(room.activityId))
        .then(() => setAttendance(true))
        .catch(() => {})
  }
  function openInfo() {
    if (room.historical) {
      setInfo(true)
      return
    }
    void client
      .ensureQueryData(membersQuery(room.id))
      .then(() => setInfo(true))
      .catch(() => {})
  }
  function openSettings() {
    void client
      .ensureQueryData(settingsQuery(room.id))
      .then(() => setSettings(true))
      .catch(() => {})
  }
  useLayoutEffect(() => {
    const element = seat.current,
      root = layout.current
    if (!element || !root) return undefined
    const input = element.querySelector<HTMLFormElement>("[data-chat-composer]")
    const resize = () => {
      root.style.setProperty("--composer-height", `${element.offsetHeight}px`)
      root.style.setProperty(
        "--composer-input-height",
        `${input?.offsetHeight ?? 50}px`
      )
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    if (input) observer.observe(input)
    return () => observer.disconnect()
  }, [room.canPost])
  useEffect(() => {
    if (!active || offline || room.historical) return
    void client.prefetchQuery(membersQuery(room.id))
    if (room.canManage) void client.prefetchQuery(settingsQuery(room.id))
  }, [client, active, offline, room.id, room.historical, room.canManage])
  const rows = useMemo(
    () =>
      messageRows(
        history.messages,
        queue.filter((item) => item.roomId === room.id),
        member
      ),
    [history.messages, queue, room.id, member]
  )
  const scroll = useMessageScroll(
    room.id,
    active,
    rows,
    history.initialRead,
    history.markRead
  )
  async function mute() {
    try {
      await changeRoomMute(client, room.id, !room.muted)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b px-3 pb-3 md:px-4">
        <Link
          onClick={(event) => {
            event.preventDefault()
            onBack()
          }}
          to="/chat"
          aria-label="チャット一覧へ"
          className="flex size-8 items-center justify-center md:hidden"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={openInfo}
          className="min-w-0 flex-1 text-left"
          aria-label={`${room.name}の情報`}
        >
          <h1 className="truncate text-sm font-semibold">{room.name}</h1>
          {roomSchedule(room) && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {roomSchedule(room)}
            </span>
          )}
        </button>
        {room.activityId && (
          <Button variant="ghost" size="sm" onClick={openAttendance}>
            出勤・連絡
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="チャットの操作"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={openInfo}>
              <Users />
              チャット情報
            </DropdownMenuItem>
            <DropdownMenuItem disabled={offline} onClick={() => void mute()}>
              {room.muted ? <Bell /> : <BellOff />}
              {room.muted ? "通知をオンにする" : "ミュートする"}
            </DropdownMenuItem>
            {room.canManage && (
              <DropdownMenuItem disabled={offline} onClick={openSettings}>
                <Settings />
                チャット設定
              </DropdownMenuItem>
            )}
            {room.kind === "custom" && !room.historical && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={offline}
                  onClick={() => setLeaving(true)}
                >
                  <LogOut />
                  退出する
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div
        ref={layout}
        className="relative min-h-0 flex-1 [--chat-gutter:1rem] [--composer-bottom:calc(var(--app-bottom-bar-height)-50px)] [--composer-height:50px] [--composer-input-height:50px]"
      >
        <section
          ref={scroll.viewport}
          onScroll={scroll.onScroll}
          aria-label="メッセージ履歴"
          className={`absolute inset-x-0 top-0 touch-pan-y touch-pinch-zoom overflow-y-auto overscroll-x-contain overscroll-y-auto [overflow-anchor:none] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden ${room.canPost ? "bottom-[calc(var(--composer-input-height)+var(--composer-bottom))]" : "bottom-0"}`}
        >
          <div
            ref={scroll.content}
            className="px-[var(--chat-gutter)] pt-4 pb-[calc(var(--composer-height)-var(--composer-input-height)+1rem)]"
          >
            {history.query.hasNextPage && (
              <div className="mb-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={history.query.isFetchingNextPage}
                  onClick={() => void history.query.fetchNextPage()}
                >
                  以前のメッセージ
                </Button>
              </div>
            )}
            <ol aria-label="メッセージ" className="min-w-0">
              {rows.map((message, index) => {
                const previous = rows[index - 1],
                  dayChanged =
                    !previous ||
                    date(previous.createdAt) !== date(message.createdAt),
                  unread =
                    history.initialRead > 0 &&
                    message.memberId !== member.id &&
                    message.sequence === history.initialRead + 1
                const grouped =
                  previous?.memberId === message.memberId &&
                  !dayChanged &&
                  !unread &&
                  Date.parse(message.createdAt) -
                    Date.parse(previous.createdAt) <
                    300_000
                return (
                  <li
                    key={message.id}
                    data-message-id={message.id}
                    data-sequence={message.sequence ?? undefined}
                    data-delivery={message.status}
                    className={grouped ? "pt-0.5" : "pt-4 first:pt-0"}
                  >
                    {dayChanged && (
                      <div className="mb-5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        <span>{date(message.createdAt)}</span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    {unread && (
                      <div className="my-4 flex items-center gap-3 text-xs font-medium">
                        <span className="h-px flex-1 bg-border" />
                        ここから未読
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className="group grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 rounded-md hover:bg-muted/25">
                      {!grouped ? (
                        <MemberAvatar
                          name={message.memberDisplayName}
                          image={message.memberImage}
                          className="mt-0.5"
                        />
                      ) : (
                        <span className="self-start pt-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                          {time(message.createdAt)}
                        </span>
                      )}
                      <div className="min-w-0">
                        {!grouped && (
                          <p className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold">
                              {message.memberDisplayName}
                            </span>
                            <time
                              dateTime={message.createdAt}
                              className="text-[11px] text-muted-foreground"
                            >
                              {time(message.createdAt)}
                            </time>
                          </p>
                        )}
                        {message.content && (
                          <p className="max-w-[85ch] text-sm leading-7 break-words whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                        <MessageImages
                          roomId={room.id}
                          images={message.attachments}
                        />
                        {message.files.length > 0 && (
                          <div
                            className={`mt-2 grid max-w-lg gap-2 ${message.files.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                          >
                            {message.files.map((file) => (
                              <div
                                key={file.id}
                                className="max-w-full overflow-hidden rounded-xl border"
                                style={imageSize(
                                  file.uploaded ?? file.dimensions
                                )}
                              >
                                <LocalImage
                                  blob={file.blob}
                                  alt={file.name}
                                  className="size-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {(message.status === "failed" ||
                          (offline && message.status !== "sent")) && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {message.status === "failed" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => store.retry(message.id)}
                              >
                                再送
                              </Button>
                            ) : (
                              "接続後に送信"
                            )}
                            {message.status !== "sending" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => store.cancel(message.id)}
                              >
                                取り消す
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
            {room.historical && (
              <p className="mt-5 text-center text-xs text-muted-foreground">
                退出前の履歴です
              </p>
            )}
          </div>
        </section>
        {scroll.showLatest && (
          <Button
            variant="outline"
            size="icon"
            aria-label="最新のメッセージへ"
            className={`absolute right-[var(--chat-gutter)] size-9 rounded-full bg-background shadow-sm ${room.canPost ? "bottom-[calc(var(--composer-height)+var(--composer-bottom)+var(--chat-gutter))]" : "bottom-[var(--chat-gutter)]"}`}
            onClick={scroll.latest}
          >
            <ArrowDown className="size-4" />
          </Button>
        )}
        {room.canPost && (
          <div
            ref={seat}
            className="absolute inset-x-[var(--chat-gutter)] bottom-[var(--composer-bottom)]"
          >
            <ChatComposer
              roomName={room.name}
              draft={draft}
              disabled={!ready}
              onChange={(value) => store.edit(room.id, value)}
              onAddFiles={(files) => {
                const current = store.draft(room.id)
                if (
                  current.files.length + files.length >
                  chatImageLimits.count
                ) {
                  toast.error("添付できる画像は10枚までです。")
                  return
                }
                store.edit(room.id, {
                  ...current,
                  files: [...current.files, ...files],
                })
              }}
              onSend={() => {
                scroll.follow()
                void store.enqueue(room.id)
              }}
            />
          </div>
        )}
      </div>
      {active && info && (
        <RoomInfo room={room} onClose={() => setInfo(false)} />
      )}
      {active && settings && (
        <ChatSettings
          id={room.id}
          year={room.year}
          onClose={() => setSettings(false)}
        />
      )}
      {active && attendance && room.activityId && (
        <ShiftAttendance
          activityId={room.activityId}
          onClose={() => {
            setAttendance(false)
            void navigate({
              to: "/chat/$roomId",
              params: { roomId: room.id },
              search: {},
              replace: true,
            })
          }}
        />
      )}
      {active && leaving && (
        <ConfirmDialog
          title="チャットから退出しますか"
          description="退出するまでの履歴は引き続き確認できます。"
          confirmLabel="退出"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false)
            void leaveChatRoom(room.id)
              .then(() =>
                Promise.all([
                  client.invalidateQueries({ queryKey: ["chat-rooms"] }),
                  client.invalidateQueries({
                    queryKey: ["chat-room", room.id],
                  }),
                ])
              )
              .catch((error) => toast.error(errorMessage(error)))
          }}
        />
      )}
    </>
  )
}
