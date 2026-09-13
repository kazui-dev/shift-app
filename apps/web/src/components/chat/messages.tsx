import { MessageText } from "./message-text"
import { japanDateWeekday, japanTime } from "@workspace/shared/japan-time"
import { MessageLinkPreview } from "./message-link-preview"
import { useMessageTarget } from "./use-message-target"
import { MessageActionDrawer } from "./message-action-drawer"
import { DeleteMessageDialog } from "./delete-message-dialog"
import { OfflineSendDialog } from "./offline-send-dialog"
import { useReplyTarget } from "./use-reply-target"
import { useMessageEdit } from "./use-message-edit"
import { MessageActions } from "./message-actions"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
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
import { messageRows, unreadMessage, type MessageRow } from "./message-list"
import { chatImageLimits } from "@workspace/shared/communications"
import { imageSize } from "./image-size"
import { RoutedImage } from "./routed-image"
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
  const [menu, setMenu] = useState<{
    message: MessageRow
    open: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState<MessageRow | null>(null)
  const [deletionClosing, setDeletionClosing] = useState(false)
  const [blockedSend, setBlockedSend] = useState(false)
  const edit = useMessageEdit(room.id)
  const composerEdit = edit.editing
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
  // Keep the row until confirmation finishes closing, even if its acknowledgement arrives first.
  const rows = useMemo(
    () =>
      messageRows(
        history.messages,
        queue.filter((item) => item.roomId === room.id),
        member,
        deletionClosing ? deleting : null
      ),
    [history.messages, queue, room.id, member, deleting, deletionClosing]
  )
  const scroll = useMessageScroll(
    room.id,
    active,
    rows,
    history.initialRead,
    history.markRead,
    history.query.data !== undefined
  )
  const selectedMessage = rows.find(
    (message) => message.id === menu?.message.id
  )
  const firstUnread = unreadMessage(rows, history.initialRead)
  const setReplyTarget = useReplyTarget(history, scroll, active, offline)
  const { target, setTarget } = useMessageTarget()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  useEffect(() => {
    if (target?.roomId === room.id && pathname === `/chat/${room.id}`) {
      setReplyTarget(target.messageId)
      setTarget(null)
    }
  }, [target, room.id, pathname, setReplyTarget, setTarget])
  function removeMessage(message: MessageRow) {
    setDeletionClosing(false)
    setDeleting(message)
  }
  function editMessage(message: MessageRow) {
    store.edit(room.id, { content: "", files: [] })
    edit.start(message)
  }
  function replyTo(message: MessageRow) {
    edit.cancel()
    if (message.sequence !== null)
      store.edit(room.id, {
        ...store.draft(room.id),
        reply: {
          id: message.id,
          sequence: message.sequence,
          memberDisplayName: message.memberDisplayName,
          memberImage: message.memberImage,
          content: message.content,
        },
      })
  }
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
                    japanDateWeekday(previous.createdAt) !==
                      japanDateWeekday(message.createdAt),
                  unread =
                    history.initialRead > 0 &&
                    message.memberId !== member.id &&
                    message.id === firstUnread?.id
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
                        <span>{japanDateWeekday(message.createdAt)}</span>
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
                      menuOpen={
                        menu?.open === true && menu.message.id === message.id
                      }
                      onMenu={() => setMenu({ message, open: true })}
                      onDelete={() => removeMessage(message)}
                      onEdit={() => editMessage(message)}
                      onReply={() => replyTo(message)}
                    >
                      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
                        {message.reply && (
                          <>
                            <div
                              aria-hidden
                              className="relative col-start-1 row-start-1"
                            >
                              <span className="pointer-events-none absolute top-2 bottom-[-2px] left-4 w-6 rounded-tl-md border-t border-l border-muted-foreground/40" />
                            </div>
                            <button
                              type="button"
                              data-message-reply
                              disabled={!!message.reply.deleted}
                              onPointerDown={(event) => event.preventDefault()}
                              onClick={(event) => {
                                event.currentTarget.blur()
                                setReplyTarget(message.reply?.id ?? null)
                              }}
                              className="col-start-2 mb-1 flex h-4 min-w-0 items-center gap-1.5 text-left text-xs leading-4 text-muted-foreground enabled:cursor-pointer enabled:hover:text-foreground"
                            >
                              {message.reply.deleted ? (
                                "削除されたメッセージ"
                              ) : (
                                <>
                                  <MemberAvatar
                                    name={message.reply.memberDisplayName}
                                    image={message.reply.memberImage ?? null}
                                    className="size-4 text-[8px]"
                                  />
                                  <span className="max-w-32 shrink-0 truncate">
                                    {message.reply.memberDisplayName}
                                  </span>
                                  <span className="truncate">
                                    {message.reply.content || "画像"}
                                  </span>
                                </>
                              )}
                            </button>
                          </>
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
                            {japanTime(message.createdAt)}
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
                                {japanTime(message.createdAt)}
                              </time>
                            </p>
                          )}
                          {(message.content || message.editedAt) && (
                            <p
                              data-message-body
                              className="max-w-[85ch] text-sm leading-7 break-words whitespace-pre-wrap"
                            >
                              <MessageText content={message.content} />
                              {message.editedAt && (
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                  (編集済)
                                </span>
                              )}
                            </p>
                          )}
                          {message.status === "sent" && (
                            <MessageLinkPreview
                              roomId={room.id}
                              messageId={message.id}
                              content={message.content}
                              offline={offline}
                            />
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
                                  state: { chatOverlay: "image" },
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
                          {message.status === "failed" && (
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (offline || !navigator.onLine)
                                    setBlockedSend(true)
                                  else store.retry(message.id)
                                }}
                              >
                                再送
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => store.cancel(message.id)}
                              >
                                取り消す
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </MessageActions>
                  </li>
                )
              })}
            </ol>
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
              disabled={!ready}
              saving={composerEdit !== null && edit.pending}
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
                if (offline || !navigator.onLine) {
                  setBlockedSend(true)
                  return
                }
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
      <MessageActionDrawer
        message={selectedMessage ?? menu?.message ?? null}
        room={room}
        memberId={member.id}
        open={menu?.open === true && !!selectedMessage && !offline}
        disabled={!selectedMessage || offline}
        onOpenChange={(open) =>
          setMenu((current) => (current ? { ...current, open } : null))
        }
        onClosed={() => setMenu(null)}
        onReply={() => {
          if (selectedMessage) replyTo(selectedMessage)
        }}
        onEdit={() => {
          if (selectedMessage) editMessage(selectedMessage)
        }}
        onDelete={() => {
          if (selectedMessage) removeMessage(selectedMessage)
        }}
      />
      {deleting && (
        <DeleteMessageDialog
          roomId={room.id}
          messageId={deleting.id}
          onConfirm={() => setDeletionClosing(true)}
          onClosed={() => {
            setDeleting(null)
            setDeletionClosing(false)
          }}
        />
      )}
      <OfflineSendDialog open={blockedSend} onOpenChange={setBlockedSend} />
      {active && <RoutedImage roomId={room.id} messages={history.messages} />}
    </>
  )
}
