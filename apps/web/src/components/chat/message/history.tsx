import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { ArrowDown } from "lucide-react"
import { chatImageLimits } from "@workspace/shared/communications"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatRoom } from "@/api/chat"
import { ComposerSeat } from "@/components/chat/composer/seat"
import { DeleteMessageDialog } from "@/components/chat/message/delete-dialog"
import { MessageActionDrawer } from "@/components/chat/message/action-drawer"
import {
  messageRows,
  unreadMessage,
  type MessageRow,
} from "@/components/chat/message/list"
import { ChatMessageRow } from "@/components/chat/message/row"
import { OfflineSendDialog } from "@/components/chat/message/offline-send-dialog"
import { RoutedImage } from "@/components/chat/image/routed"
import { useChatStore } from "@/components/chat/use-chat-store"
import { useMessageEdit } from "@/components/chat/message/use-edit"
import { useMessageScroll } from "@/components/chat/message/use-scroll"
import { useMessageTarget } from "@/components/chat/message/use-target"
import { useMessages } from "@/components/chat/message/use-history"
import { useReplyTarget } from "@/components/chat/message/use-reply-target"

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
  const [focusRequest, setFocusRequest] = useState(0)
  const edit = useMessageEdit(room.id)
  const composerEdit = edit.editing
  const { store, member, ready, queue } = useChatStore(),
    draft = store.draft(room.id)
  const history = useMessages(room, offline, active),
    layout = useRef<HTMLDivElement>(null)
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
  // The draft, its images and reply target wait underneath an edit.
  function editMessage(message: MessageRow) {
    edit.start(message)
    setFocusRequest((request) => request + 1)
  }
  function replyTo(message: MessageRow) {
    edit.cancel()
    setFocusRequest((request) => request + 1)
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
              {rows.map((message, index) => (
                <ChatMessageRow
                  key={message.id}
                  message={message}
                  previous={rows[index - 1]}
                  room={room}
                  memberId={member.id}
                  offline={offline}
                  unread={
                    history.initialRead > 0 &&
                    message.memberId !== member.id &&
                    message.id === firstUnread?.id
                  }
                  editing={edit.editing?.id === message.id}
                  menuOpen={
                    menu?.open === true && menu.message.id === message.id
                  }
                  actions={{
                    onMenu: () => setMenu({ message, open: true }),
                    onReply: () => replyTo(message),
                    onEdit: () => editMessage(message),
                    onDelete: () => removeMessage(message),
                    onOpenReply: (id) => setReplyTarget(id),
                    onOpenImage: (image, sequence) =>
                      void navigate({
                        to: "/chat/$roomId",
                        params: { roomId: room.id },
                        search: { image, message: sequence },
                        state: { chatOverlay: "image" },
                        resetScroll: false,
                      }),
                    onRetry: () => {
                      if (offline || !navigator.onLine) setBlockedSend(true)
                      else store.retry(message.id)
                    },
                    onCancel: () => store.cancel(message.id),
                  }}
                />
              ))}
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
        <ComposerSeat
          root={layout}
          canPost={room.canPost}
          roomName={room.name}
          draft={
            composerEdit ? { ...draft, content: composerEdit.content } : draft
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
          focusRequest={focusRequest}
        />
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
