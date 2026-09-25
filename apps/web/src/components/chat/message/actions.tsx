import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CornerUpLeft, Pencil, RotateCw, Trash2, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { messagePermissions } from "@workspace/shared/messages"
import type { ChatRoom } from "@/api/chat"
import type { MessageRow } from "@/components/chat/message/list"

/**
 * Controls inside a message are their own targets. Touching a link, an image,
 * the reply chip or any button never presses, colors or opens the message.
 */
const controls = "a,button,input,textarea,select,[role=toolbar]"
/** A control that opens the message's actions, like the failed mark. */
const opener = "[data-open-actions]"

export function MessageActions({
  message,
  room,
  memberId,
  offline,
  onReply,
  onEdit,
  onDelete,
  onMenu,
  onRetry,
  onCancel,
  menuOpen,
  editing,
  children,
}: {
  message: MessageRow
  room: ChatRoom
  memberId: string
  offline: boolean
  onEdit: () => void
  onDelete: () => void
  onMenu: () => void
  onRetry: () => void
  onCancel: () => void
  menuOpen: boolean
  editing: boolean
  onReply: () => void
  children: ReactNode
}) {
  const mobile = useMediaQuery("(max-width: 767px)")
  const [pressed, setPressed] = useState(false)
  const root = useRef<HTMLElement>(null)
  const press = useRef<{
    x: number
    y: number
    timer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const consumed = useRef(false)
  const [opened, setOpened] = useState(false)
  // A message not yet sent is only sent again or taken back.
  const pending = message.status !== "sent"
  const openActions = useEffectEvent(() => {
    if (mobile) onMenu()
    else setOpened(true)
  })
  const permission = messagePermissions({
    memberId,
    authorId: message.memberId,
    canPost: room.canPost,
    canManage: room.canManage,
    deleted: !!message.deleted,
    bot: !!message.bot,
  })
  const available =
    pending ||
    (!offline && (permission.reply || permission.edit || permission.delete))
  function cancelPress() {
    if (press.current?.timer) clearTimeout(press.current.timer)
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    releaseTimer.current = null
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
      if (
        event.pointerType === "mouse" ||
        !event.isPrimary ||
        (event.target instanceof Element && event.target.closest(controls))
      )
        return
      setPressed(true)
      const { clientX: x, clientY: y } = event
      press.current = {
        x,
        y,
        timer: available
          ? setTimeout(() => {
              consumed.current = true
              openActions()
              press.current = null
            }, 400)
          : null,
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
    const up = () => {
      if (!press.current) {
        cancelPress()
        return
      }
      if (press.current.timer) clearTimeout(press.current.timer)
      press.current = null
      releaseTimer.current = setTimeout(() => {
        setPressed(false)
        releaseTimer.current = null
      }, 120)
    }
    const click = (event: MouseEvent) => {
      if (consumed.current) {
        event.preventDefault()
        event.stopPropagation()
        consumed.current = false
        return
      }
      if (event.target instanceof Element && event.target.closest(opener)) {
        event.preventDefault()
        openActions()
      }
    }
    const context = (event: MouseEvent) => {
      if (
        !available ||
        (event.target instanceof Element && event.target.closest(controls))
      )
        return
      event.preventDefault()
      cancelPress()
      openActions()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpened(false)
      }
    }
    element.addEventListener("pointerdown", down)
    element.addEventListener("pointermove", move)
    element.addEventListener("pointerup", up)
    element.addEventListener("pointercancel", cancelPress)
    element.addEventListener("contextmenu", context)
    element.addEventListener("click", click, true)
    element.addEventListener("keydown", key)
    return () => {
      cancelPress()
      element.removeEventListener("pointerdown", down)
      element.removeEventListener("pointermove", move)
      element.removeEventListener("pointerup", up)
      element.removeEventListener("pointercancel", cancelPress)
      element.removeEventListener("contextmenu", context)
      element.removeEventListener("click", click, true)
      element.removeEventListener("keydown", key)
    }
  }, [available, editing])
  return (
    <article
      ref={root}
      aria-label={`${message.memberDisplayName}のメッセージ`}
      data-message-actions
      data-active={opened || menuOpen || pressed || undefined}
      data-editing={editing || undefined}
      className={`group relative -mx-[var(--chat-gutter)] px-[var(--chat-gutter)] transition-colors duration-200 motion-reduce:transition-none [@media(pointer:coarse)]:select-none ${editing ? "bg-blue-500/10 dark:bg-blue-400/15" : "focus-within:[&:not(:has([data-message-content]_:focus))]:bg-foreground/5 [@media(hover:hover)]:hover:[&:not(:has([data-message-content]_:is(a,button):hover))]:bg-foreground/5"} ${!editing && (opened || menuOpen || pressed) ? "bg-foreground/5" : ""}`}
    >
      {available && (
        <button
          type="button"
          className="sr-only"
          onClick={() => {
            if (mobile) onMenu()
            else setOpened(true)
          }}
        >
          メッセージの操作を表示
        </button>
      )}
      {children}
      {available && !editing && !mobile && (
        <div
          role="toolbar"
          aria-label="メッセージの操作"
          className={`absolute -top-7 right-4 z-10 flex rounded-lg border bg-background p-0.5 shadow-sm [&>button]:transition-colors ${opened ? "" : "invisible group-focus-within:visible [@media(hover:hover)]:group-hover:visible"}`}
        >
          {message.status === "failed" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="再送"
              title="再送"
              onClick={() => {
                onRetry()
                setOpened(false)
              }}
            >
              <RotateCw />
            </Button>
          )}
          {pending && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="取り消し"
              title="取り消し"
              className="text-destructive"
              onClick={() => {
                onCancel()
                setOpened(false)
              }}
            >
              <X />
            </Button>
          )}
          {!pending && permission.reply && (
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
          {!pending && permission.edit && (
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
          {!pending && permission.delete && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="削除"
              title="削除"
              onClick={() => {
                onDelete()
                setOpened(false)
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
