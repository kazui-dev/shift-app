import { useMessageEdit } from "./use-message-edit"
import { MessageEditor } from "./message-editor"
import { useMediaQuery } from "@/hooks/use-media-query"
import { MessageActions } from "./message-actions"
import { useLayoutEffect, useMemo, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowDown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatRoom } from "@/api/chat"
import { ChatComposer } from "./composer"
import { useChatStore } from "./use-chat-store"
import { useMessages } from "./use-messages"
import { useMessageScroll } from "./use-message-scroll"
import { MessageImages, LocalImage } from "./images"
import { MemberAvatar } from "../member-avatar"
import { messageRows } from "./message-list"
import { chatImageLimits } from "@workspace/shared/communications"
import { imageSize } from "./image-size"
import { RoutedImage } from "./routed-image"
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
export function ChatMessages({
  room,
  offline,
  active,
}: {
  room: ChatRoom
  offline: boolean
  active: boolean
}) {
  const navigate = useNavigate()
  const edit = useMessageEdit(room.id)
  const mobile = useMediaQuery("(max-width: 767px)")
  const composerEdit = mobile ? edit.editing : null
  const { store, member, ready, queue } = useChatStore(),
    draft = store.draft(room.id)
  const history = useMessages(room, offline, active),
    seat = useRef<HTMLDivElement>(null),
    layout = useRef<HTMLDivElement>(null)
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
  return (
    <>
      <div
        ref={layout}
        className="relative min-h-0 flex-1 [--chat-gutter:1rem] [--composer-bottom:calc(var(--app-bottom-bar-height)-50px)] [--composer-height:50px] [--composer-input-height:50px]"
      >
        <section
          ref={scroll.viewport}
          onScroll={scroll.onScroll}
          aria-label="メッセージ履歴"
          className={`absolute inset-x-0 top-0 touch-pan-y overflow-y-auto overscroll-x-contain overscroll-y-auto [overflow-anchor:none] max-md:[scrollbar-width:none] ${room.canPost ? "bottom-[calc(var(--composer-input-height)+var(--composer-bottom))]" : "bottom-0"}`}
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
                  !message.reply &&
                  !message.deleted &&
                  !previous?.deleted &&
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
                    <MessageActions
                      message={message}
                      room={room}
                      memberId={member.id}
                      offline={offline}
                      editing={edit.editing?.id === message.id}
                      onEdit={() => edit.start(message)}
                      onReply={() => {
                        edit.cancel()
                        if (message.sequence !== null)
                          store.edit(room.id, {
                            ...store.draft(room.id),
                            reply: {
                              id: message.id,
                              sequence: message.sequence,
                              memberDisplayName: message.memberDisplayName,
                              content: message.content,
                            },
                          })
                      }}
                    >
                      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
                        {message.reply && (
                          <div className="col-start-2 mb-1 flex gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0">
                              ↪ {message.reply.memberDisplayName}
                            </span>
                            <span className="truncate">
                              {message.reply.deleted
                                ? "削除されたメッセージ"
                                : message.reply.content || "画像"}
                            </span>
                          </div>
                        )}
                        {!grouped ? (
                          <MemberAvatar
                            name={message.memberDisplayName}
                            image={message.memberImage}
                            className="mt-0.5"
                          />
                        ) : (
                          <time
                            dateTime={message.createdAt}
                            className="flex h-7 items-center justify-center self-start text-[10px] whitespace-nowrap text-muted-foreground tabular-nums opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 group-data-active:opacity-100"
                          >
                            {time(message.createdAt)}
                          </time>
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
                          {message.deleted && (
                            <p className="text-sm leading-7 text-muted-foreground">
                              削除されたメッセージ
                            </p>
                          )}
                          {edit.editing?.id === message.id && !mobile ? (
                            <MessageEditor
                              content={edit.editing.content}
                              hasImages={edit.editing.hasImages}
                              pending={edit.pending}
                              onChange={edit.change}
                              onSave={(value) => void edit.save(value)}
                              onCancel={edit.cancel}
                            />
                          ) : (
                            !message.deleted &&
                            (message.content || message.editedAt) && (
                              <p
                                data-message-body
                                className="max-w-[85ch] text-sm leading-7 break-words whitespace-pre-wrap"
                              >
                                {message.content}
                                {message.editedAt && (
                                  <span className="ml-2 text-[10px] text-muted-foreground">
                                    (編集済)
                                  </span>
                                )}
                              </p>
                            )
                          )}
                          <MessageImages
                            roomId={room.id}
                            images={message.attachments}
                            onOpen={(image) => {
                              if (message.sequence !== null)
                                void navigate({
                                  to: "/chat/$roomId",
                                  params: { roomId: room.id },
                                  search: { image, message: message.sequence },
                                  state: { chatImage: true },
                                  resetScroll: false,
                                })
                            }}
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
                    </MessageActions>
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
              draft={
                composerEdit
                  ? { content: composerEdit.content, files: [] }
                  : draft
              }
              editing={
                composerEdit
                  ? {
                      id: composerEdit.id,
                      hasImages: composerEdit.hasImages,
                      onCancel: edit.cancel,
                    }
                  : undefined
              }
              disabled={!ready || (composerEdit !== null && edit.pending)}
              onChange={(value) =>
                composerEdit
                  ? edit.change(value.content)
                  : store.edit(room.id, value)
              }
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
                if (composerEdit) {
                  void edit.save(composerEdit.content)
                  return
                }
                scroll.follow()
                void store.enqueue(room.id)
              }}
            />
          </div>
        )}
      </div>
      {active && <RoutedImage roomId={room.id} messages={history.messages} />}
    </>
  )
}
