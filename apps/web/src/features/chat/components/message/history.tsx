import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { ArrowDown, LoaderCircle } from "lucide-react"
import { chatImageLimits } from "@workspace/shared/communications"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatRoom } from "@/features/chat/api/chat"
import type { ComposerHandle } from "@/features/chat/components/composer/form"
import { ComposerSeat } from "@/features/chat/components/composer/seat"
import { DeleteMessageDialog } from "@/features/chat/components/message/delete-dialog"
import { MessageActionDrawer } from "@/features/chat/components/message/action-drawer"
import {
  messageRows,
  unreadMessage,
  type MessageRow,
} from "@/features/chat/components/message/list"
import { ChatMessageRow } from "@/features/chat/components/message/row"
import { OfflineSendDialog } from "@/features/chat/components/message/offline-send-dialog"
import { useChatStore } from "@/features/chat/components/use-chat-store"
import { useMessageEdit } from "@/features/chat/components/message/use-edit"
import { useMessageScroll } from "@/features/chat/components/message/use-scroll"
import { useMessageTarget } from "@/features/chat/components/message/use-target"
import { useMessages } from "@/features/chat/components/message/use-history"
import { useReplyTarget } from "@/features/chat/components/message/use-reply-target"

// The viewer and its carousel load when an image first opens.
const RoutedImage = lazy(() =>
  import("@/features/chat/components/image/routed").then((module) => ({
    default: module.RoutedImage,
  }))
)

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
  const composer = useRef<ComposerHandle>(null)
  const edit = useMessageEdit(room.id)
  const composerEdit = edit.editing
  const { store, member, ready, queue, uploads } = useChatStore(),
    draft = store.draft(room.id)
  const history = useMessages(room, offline, active),
    older = useRef<HTMLDivElement>(null)
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
    member.id,
    history.markRead,
    history.query.data !== undefined
  )
  const selectedMessage = rows.find(
    (message) => message.id === menu?.message.id
  )
  const firstUnread = unreadMessage(rows, history.initialRead, member.id)
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
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = history.query
  useEffect(() => {
    const list = scroll.viewport.current,
      sentinel = older.current
    if (!list || !sentinel || !active || offline || !hasNextPage)
      return undefined
    if (isFetchingNextPage) return undefined
    // Start loading about a screen before the top, so reading back never stalls.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage()
      },
      { root: list, rootMargin: "100% 0px 0px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    scroll.viewport,
    active,
    offline,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])
  function copyMessage(message: MessageRow) {
    void navigator.clipboard.writeText(message.content).then(
      () => toast.success("コピーしました。"),
      () => toast.error("コピーできませんでした。")
    )
  }
  function removeMessage(message: MessageRow) {
    setDeletionClosing(false)
    setDeleting(message)
  }
  // The draft, its images and reply target wait underneath an edit.
  function editMessage(message: MessageRow) {
    edit.start(message)
    composer.current?.focus()
  }
  function replyTo(message: MessageRow) {
    edit.cancel()
    composer.current?.focus()
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
  function send() {
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
  }
  const composerDraft = composerEdit
    ? { ...draft, content: composerEdit.content }
    : draft
  // The history runs under the composer by exactly its fade, so the backdrop
  // can dissolve messages without any measured heights.
  const composerSpacing = composerDraft.files.length
    ? "[--composer-backdrop:-1.5rem] [--composer-overlap:calc(var(--composer-backdrop)+3rem)]"
    : "[--composer-backdrop:-1.4375rem] [--composer-overlap:calc(var(--composer-backdrop)+3rem)]"
  return (
    <>
      <div
        className={`flex min-h-0 flex-1 flex-col [--chat-gutter:1rem] [--composer-bottom:calc(var(--app-bottom-bar-height)-50px)] ${composerSpacing}`}
      >
        <div className="relative min-h-0 flex-1">
          <section
            ref={scroll.viewport}
            data-chat-history
            onScroll={scroll.onScroll}
            aria-label="メッセージ履歴"
            className="absolute inset-0 touch-pan-y overflow-y-auto overscroll-x-contain overscroll-y-auto [overflow-anchor:none] [scrollbar-width:none]"
          >
            <div
              ref={scroll.content}
              className="px-[var(--chat-gutter)] pt-4 pb-[calc(var(--composer-overlap)+1rem)]"
            >
              <div ref={older} aria-hidden />
              <ol aria-label="メッセージ" className="min-w-0">
                {rows.map((message, index) => (
                  <ChatMessageRow
                    key={message.id}
                    message={message}
                    previous={rows[index - 1]}
                    room={room}
                    memberId={member.id}
                    offline={offline}
                    unread={message.id === firstUnread?.id}
                    editing={edit.editing?.id === message.id}
                    menuOpen={
                      menu?.open === true && menu.message.id === message.id
                    }
                    actions={{
                      onMenu: () => setMenu({ message, open: true }),
                      onReply: () => replyTo(message),
                      onEdit: () => editMessage(message),
                      onDelete: () => removeMessage(message),
                      onRetry: () => {
                        if (offline || !navigator.onLine) setBlockedSend(true)
                        else store.retry(message.id)
                      },
                      onCancel: () => store.cancel(message.id),
                      onOpenReply: (id) => setReplyTarget(id),
                      onOpenImage: (image, sequence) =>
                        void navigate({
                          to: "/chat/$roomId",
                          params: { roomId: room.id },
                          search: { image, message: sequence },
                          state: { chatOverlay: "image" },
                          resetScroll: false,
                        }),
                    }}
                    uploads={uploads}
                  />
                ))}
              </ol>
            </div>
          </section>
          {history.query.isFetchingNextPage && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <output
                aria-label="以前のメッセージを読み込み中"
                className="flex size-8 items-center justify-center rounded-full border bg-background shadow-sm"
              >
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              </output>
            </div>
          )}
        </div>
        <div className="relative z-10 -mt-[var(--composer-overlap)] shrink-0">
          {scroll.showLatest && (
            <Button
              variant="outline"
              size="icon"
              aria-label="最新のメッセージへ"
              className="absolute right-[var(--chat-gutter)] bottom-[calc(100%+var(--chat-gutter))] size-9 rounded-full bg-background shadow-sm dark:bg-background dark:hover:bg-muted"
              onClick={scroll.latest}
            >
              <ArrowDown className="size-4" />
            </Button>
          )}
          <ComposerSeat
            canPost={room.canPost}
            roomName={room.name}
            draft={composerDraft}
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
            onChange={(value) => {
              if (!composerEdit) {
                store.edit(room.id, value)
                return
              }
              edit.change(value.content)
              const current = store.draft(room.id)
              if (value.files !== current.files)
                store.edit(room.id, { ...current, files: value.files })
            }}
            onAddFiles={(files) => {
              const current = store.draft(room.id)
              if (current.files.length + files.length > chatImageLimits.count) {
                toast.error("添付できる画像は10枚までです。")
                return
              }
              store.edit(room.id, {
                ...current,
                files: [...current.files, ...files],
              })
            }}
            onSend={send}
            handle={composer}
          />
        </div>
      </div>
      <MessageActionDrawer
        message={selectedMessage ?? menu?.message ?? null}
        room={room}
        memberId={member.id}
        open={
          menu?.open === true &&
          !!selectedMessage &&
          (!offline || selectedMessage.status !== "sent")
        }
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
        onCopy={() => {
          if (selectedMessage) copyMessage(selectedMessage)
        }}
        onDelete={() => {
          if (selectedMessage) removeMessage(selectedMessage)
        }}
        onRetry={() => {
          if (!selectedMessage) return
          if (offline || !navigator.onLine) setBlockedSend(true)
          else store.retry(selectedMessage.id)
        }}
        onCancel={() => {
          if (selectedMessage) store.cancel(selectedMessage.id)
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
      {active && (
        <Suspense>
          <RoutedImage roomId={room.id} messages={history.messages} />
        </Suspense>
      )}
    </>
  )
}
