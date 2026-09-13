import { useLayoutEffect, useRef, type RefObject } from "react"
import type { ChatDraft, ChatFile } from "@/lib/chat-store"
import { ChatComposer } from "./composer"

/**
 * Holds the composer above the history and publishes its measured height, so
 * the history can keep the newest message visible while the composer grows.
 */
export function ComposerSeat({
  root,
  roomName,
  draft,
  editing,
  disabled,
  saving,
  canPost,
  onChange,
  onAddFiles,
  onSend,
}: {
  root: RefObject<HTMLDivElement | null>
  roomName: string
  draft: ChatDraft
  editing?: { id: string; hasImages: boolean; onCancel: () => void } | undefined
  disabled: boolean
  saving: boolean
  canPost: boolean
  onChange: (draft: ChatDraft) => void
  onAddFiles: (files: ChatFile[]) => void
  onSend: () => void
}) {
  const seat = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = seat.current,
      layout = root.current
    if (!element || !layout) return undefined
    const input = element.querySelector<HTMLFormElement>("[data-chat-composer]")
    const resize = () => {
      layout.style.setProperty("--composer-height", `${element.offsetHeight}px`)
      layout.style.setProperty(
        "--composer-input-height",
        `${input?.offsetHeight ?? 50}px`
      )
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    if (input) observer.observe(input)
    return () => observer.disconnect()
  }, [root, canPost])
  if (!canPost) return null
  return (
    <div
      ref={seat}
      className="absolute inset-x-[var(--chat-gutter)] bottom-[var(--composer-bottom)]"
    >
      <ChatComposer
        roomName={roomName}
        draft={draft}
        editing={editing}
        disabled={disabled}
        saving={saving}
        onChange={onChange}
        onAddFiles={onAddFiles}
        onSend={onSend}
      />
    </div>
  )
}
