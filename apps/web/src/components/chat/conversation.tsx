import { roomQuery } from "./queries"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
import { getChatRoom, leaveChatRoom, updateChatPreferences } from "@/api/chat"
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
        <div className="flex h-14 items-center gap-3 border-b px-3 md:px-5">
          <Link
            to="/chat"
            onClick={(event) => {
              event.preventDefault()
              onBack()
            }}
            className="md:hidden"
            aria-label="ルーム一覧へ"
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
    [attendance, setAttendance] = useState(!!report),
    [leaving, setLeaving] = useState(false)
  const { store, member, ready, queue } = useChatStore(),
    draft = store.draft(room.id),
    pending = queue.filter((item) => item.roomId === room.id)
  const history = useMessages(room, offline, active),
    seat = useRef<HTMLDivElement>(null),
    layout = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (report) setAttendance(true)
  }, [report])
  useLayoutEffect(() => {
    const element = seat.current,
      root = layout.current
    if (!element || !root) return undefined
    const resize = () =>
      root.style.setProperty("--composer-height", `${element.offsetHeight}px`)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [room.canPost])
  const rows = messageRows(history.messages, pending, member)
  async function mute() {
    try {
      await updateChatPreferences(room.id, { muted: !room.muted })
      await Promise.all([
        client.invalidateQueries({ queryKey: ["chat-rooms"] }),
        client.invalidateQueries({ queryKey: ["chat-room", room.id] }),
      ])
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-1 pb-2 md:px-5">
        <Link
          onClick={(event) => {
            event.preventDefault()
            onBack()
          }}
          to="/chat"
          aria-label="ルーム一覧へ"
          className="flex size-8 items-center justify-center md:hidden"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={() => setInfo(true)}
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
          <Button variant="ghost" size="sm" onClick={() => setAttendance(true)}>
            出勤・連絡
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="ルームの操作"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => setInfo(true)}>
              <Users />
              ルーム情報
            </DropdownMenuItem>
            <DropdownMenuItem disabled={offline} onClick={() => void mute()}>
              {room.muted ? <Bell /> : <BellOff />}
              {room.muted ? "通知をオンにする" : "ミュートする"}
            </DropdownMenuItem>
            {room.canManage && (
              <DropdownMenuItem
                disabled={offline}
                onClick={() => setSettings(true)}
              >
                <Settings />
                ルーム設定
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
        className="relative min-h-0 flex-1 [--composer-height:52px]"
      >
        <div
          ref={history.viewport}
          onScroll={history.onScroll}
          className={`absolute inset-0 touch-pan-y touch-pinch-zoom overflow-y-auto overscroll-x-contain overscroll-y-auto px-3 pt-4 md:px-5 ${room.canPost ? "pb-[calc(var(--composer-height)+2.5rem)]" : "pb-6"}`}
        >
          {history.query.hasNextPage && (
            <div className="mb-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                disabled={history.query.isFetchingNextPage}
                onClick={history.older}
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
                Date.parse(message.createdAt) - Date.parse(previous.createdAt) <
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
                              className="w-fit overflow-hidden rounded-xl border"
                            >
                              <LocalImage
                                blob={file.blob}
                                alt={file.name}
                                className="max-h-80 w-auto max-w-full object-contain"
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
        {!history.atBottom && (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-[calc(var(--composer-height)+2rem)] left-1/2 -translate-x-1/2 rounded-full bg-background shadow-sm"
            onClick={history.latest}
          >
            <ArrowDown className="size-3.5" />
            最新へ
          </Button>
        )}
        {room.canPost && (
          <div
            ref={seat}
            className="absolute inset-x-2 bottom-4 md:inset-x-5 md:bottom-3"
          >
            <ChatComposer
              draft={draft}
              disabled={!ready}
              onChange={(value) => store.edit(room.id, value)}
              onSend={() => {
                void store
                  .enqueue(room.id)
                  .then(() => requestAnimationFrame(history.latest))
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
          title="ルームから退出しますか"
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
