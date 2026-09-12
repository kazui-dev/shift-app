import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CornerUpLeft, Pencil, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"
import { messagePermissions } from "@workspace/shared/communications"
import { editChatMessage, deleteChatMessage, type ChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { receiveMessage } from "@/data/chat-cache"
import { ConfirmDialog } from "../confirm-dialog"
import type { MessageRow } from "./message-list"

export function MessageActions({
  message,
  room,
  memberId,
  offline,
  onReply,
  children,
}: {
  message: MessageRow
  room: ChatRoom
  memberId: string
  offline: boolean
  onReply: () => void
  children: ReactNode
}) {
  const client = useQueryClient()
  const root = useRef<HTMLDivElement>(null)
  const press = useRef<{
    x: number
    y: number
    timer: ReturnType<typeof setTimeout>
  } | null>(null)
  const consumed = useRef(false)
  const [opened, setOpened] = useState(false),
    [editing, setEditing] = useState(false),
    [removing, setRemoving] = useState(false)
  const [content, setContent] = useState(message.content),
    [pending, setPending] = useState(false)
  const permission = messagePermissions({
    memberId,
    authorId: message.memberId,
    canPost: room.canPost,
    canManage: room.canManage,
    historical: room.historical,
    deleted: !!message.deleted,
  })
  const available =
    !offline &&
    message.status === "sent" &&
    (permission.reply || permission.edit || permission.delete)
  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  useEffect(() => () => cancelPress(), [])
  useEffect(() => {
    if (!opened) return undefined
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpened(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [opened])
  useEffect(() => {
    const element = root.current
    if (!element || !available || editing) return undefined
    const down = (event: PointerEvent) => {
      consumed.current = false
      cancelPress()
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest("button")
      if (
        event.pointerType === "mouse" ||
        !event.isPrimary ||
        target?.closest("input,textarea,a,select,[role=toolbar]") ||
        (button && !button.querySelector("img"))
      )
        return
      const { clientX: x, clientY: y } = event
      press.current = {
        x,
        y,
        timer: setTimeout(() => {
          consumed.current = true
          setOpened(true)
          press.current = null
        }, 450),
      }
    }
    const move = (event: PointerEvent) => {
      if (
        press.current &&
        Math.hypot(
          event.clientX - press.current.x,
          event.clientY - press.current.y
        ) > 10
      )
        cancelPress()
    }
    const click = (event: MouseEvent) => {
      if (consumed.current) {
        event.preventDefault()
        event.stopPropagation()
        consumed.current = false
      }
    }
    const context = (event: MouseEvent) => {
      event.preventDefault()
      cancelPress()
      setOpened(true)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpened(false)
        setEditing(false)
      }
    }
    element.addEventListener("pointerdown", down)
    element.addEventListener("pointermove", move)
    element.addEventListener("pointerup", cancelPress)
    element.addEventListener("pointercancel", cancelPress)
    element.addEventListener("contextmenu", context)
    element.addEventListener("click", click, true)
    element.addEventListener("keydown", key)
    return () => {
      cancelPress()
      element.removeEventListener("pointerdown", down)
      element.removeEventListener("pointermove", move)
      element.removeEventListener("pointerup", cancelPress)
      element.removeEventListener("pointercancel", cancelPress)
      element.removeEventListener("contextmenu", context)
      element.removeEventListener("click", click, true)
      element.removeEventListener("keydown", key)
    }
  }, [available, editing])
  async function save(deleting = false) {
    if (pending) return
    setPending(true)
    try {
      const { message: updated } = await (deleting
        ? deleteChatMessage(room.id, message.id)
        : editChatMessage(room.id, message.id, content))
      receiveMessage(client, room.id, updated)
      await Promise.all([
        client.invalidateQueries({ queryKey: ["chat-messages", room.id] }),
        client.invalidateQueries({ queryKey: ["chat-image-message", room.id] }),
      ])
      setEditing(false)
      setRemoving(false)
      setOpened(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <div
      ref={root}
      aria-label={`${message.memberDisplayName}のメッセージ`}
      data-message-actions
      data-active={opened || undefined}
      data-editing={editing || undefined}
      className={`group relative -mx-[var(--chat-gutter)] px-[var(--chat-gutter)] focus-within:bg-muted/25 hover:bg-muted/25 data-editing:[&_[data-message-body]]:hidden [@media(pointer:coarse)]:select-none ${opened ? "bg-muted/25" : ""}`}
    >
      {available && (
        <button
          type="button"
          className="sr-only"
          onClick={() => setOpened(true)}
        >
          メッセージの操作を表示
        </button>
      )}
      {children}
      {available && !editing && (
        <div
          role="toolbar"
          aria-label="メッセージの操作"
          className={`absolute -top-7 right-4 z-10 flex rounded-lg border bg-background p-0.5 shadow-sm ${opened ? "" : "invisible group-focus-within:visible [@media(hover:hover)]:group-hover:visible"}`}
        >
          {permission.reply && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="返信"
              title="返信"
              onClick={() => {
                onReply()
                setOpened(false)
              }}
            >
              <CornerUpLeft />
            </Button>
          )}
          {permission.edit && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="編集"
              title="編集"
              onClick={() => {
                setContent(message.content)
                setEditing(true)
                setOpened(false)
              }}
            >
              <Pencil />
            </Button>
          )}
          {permission.delete && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="削除"
              title="削除"
              onClick={() => {
                setRemoving(true)
                setOpened(false)
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
      {editing && (
        <form
          className="ml-11 space-y-2 pb-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Textarea
            ref={(element) => element?.focus()}
            aria-label="メッセージを編集"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !pending) {
                event.preventDefault()
                setEditing(false)
              }
            }}
            maxLength={2000}
            value={content}
            disabled={pending}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                pending || (!content.trim() && !message.attachments.length)
              }
            >
              保存
            </Button>
          </div>
        </form>
      )}
      {removing && (
        <ConfirmDialog
          title="メッセージを削除しますか"
          description="本文と添付画像を削除します。この操作は取り消せません。"
          confirmLabel="削除"
          onCancel={() => {
            if (!pending) setRemoving(false)
          }}
          onConfirm={() => void save(true)}
        />
      )}
    </div>
  )
}
