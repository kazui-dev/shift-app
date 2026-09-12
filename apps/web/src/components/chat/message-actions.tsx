import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CornerUpLeft, Pencil, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { useMediaQuery } from "@/hooks/use-media-query"
import { toast } from "@workspace/ui/lib/toast"
import { messagePermissions } from "@workspace/shared/communications"
import { deleteChatMessage, type ChatRoom } from "@/api/chat"
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
  onEdit,
  editing,
  children,
}: {
  message: MessageRow
  room: ChatRoom
  memberId: string
  offline: boolean
  onEdit: () => void
  editing: boolean
  onReply: () => void
  children: ReactNode
}) {
  const client = useQueryClient()
  const mobile = useMediaQuery("(max-width: 767px)")
  const [pressed, setPressed] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const press = useRef<{
    x: number
    y: number
    timer: ReturnType<typeof setTimeout>
  } | null>(null)
  const consumed = useRef(false)
  const [opened, setOpened] = useState(false),
    [removing, setRemoving] = useState(false)
  const [pending, setPending] = useState(false)
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
    setPressed(false)
  }
  useEffect(() => {
    const reset = () => {
      consumed.current = false
    }
    document.addEventListener("pointerdown", reset, true)
    return () => {
      cancelPress()
      document.removeEventListener("pointerdown", reset, true)
    }
  }, [])
  useEffect(() => {
    if (!opened || mobile) return undefined
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpened(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [opened, mobile])
  useEffect(() => {
    const element = root.current
    if (!element || editing) return undefined
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
      setPressed(true)
      if (!available) return
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
      if (!available) return
      event.preventDefault()
      cancelPress()
      setOpened(true)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpened(false)
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
  async function remove() {
    if (pending) return
    setPending(true)
    try {
      const { message: updated } = await deleteChatMessage(room.id, message.id)
      receiveMessage(client, room.id, updated)
      await Promise.all([
        client.invalidateQueries({ queryKey: ["chat-messages", room.id] }),
        client.invalidateQueries({ queryKey: ["chat-image-message", room.id] }),
      ])
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
      data-active={opened || pressed || undefined}
      data-editing={editing || undefined}
      className={`group relative -mx-[var(--chat-gutter)] px-[var(--chat-gutter)] transition-colors duration-200 motion-reduce:transition-none [@media(pointer:coarse)]:select-none ${editing ? "bg-blue-500/10 dark:bg-blue-400/15" : "focus-within:bg-foreground/5 [@media(hover:hover)]:hover:bg-foreground/5"} ${!editing && (opened || pressed) ? "bg-foreground/5" : ""}`}
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
      {available &&
        !editing &&
        (mobile ? (
          <Drawer
            open={opened}
            onOpenChange={(next, details) => {
              // The release that completed a long press belongs to the message,
              // not to the drawer backdrop that just appeared under the finger.
              if (
                !next &&
                consumed.current &&
                details.reason === "outside-press"
              ) {
                details.cancel()
                return
              }
              setOpened(next)
            }}
          >
            <DrawerContent
              finalFocus={false}
              className="pb-[env(safe-area-inset-bottom)]"
            >
              <DrawerTitle className="sr-only">メッセージの操作</DrawerTitle>
              <div className="flex flex-col gap-1 p-3">
                {permission.reply && (
                  <Button
                    variant="ghost"
                    className="h-12 justify-start"
                    onClick={() => {
                      onReply()
                      setOpened(false)
                    }}
                  >
                    <CornerUpLeft />
                    返信
                  </Button>
                )}
                {permission.edit && (
                  <Button
                    variant="ghost"
                    className="h-12 justify-start"
                    onClick={() => {
                      onEdit()
                      setOpened(false)
                    }}
                  >
                    <Pencil />
                    編集
                  </Button>
                )}
                {permission.delete && (
                  <Button
                    variant="ghost"
                    className="h-12 justify-start text-destructive"
                    onClick={() => {
                      setRemoving(true)
                      setOpened(false)
                    }}
                  >
                    <Trash2 />
                    削除
                  </Button>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
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
                  onEdit()
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
        ))}
      {removing && (
        <ConfirmDialog
          title="メッセージを削除しますか"
          description="本文と添付画像を削除します。この操作は取り消せません。"
          confirmLabel="削除"
          onCancel={() => {
            if (!pending) setRemoving(false)
          }}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  )
}
