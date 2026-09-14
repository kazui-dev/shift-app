import type { RefObject } from "react"
import type { ComposerHandle } from "@/components/chat/composer/form"
import type { ChatDraft, ChatFile } from "@/lib/chat/store"
import { ChatComposer } from "@/components/chat/composer/form"

/**
 * The composer area below the history. Its backdrop starts partway into the
 * rail or the composer and fades to the background down to the bottom edge.
 */
export function ComposerSeat({
  roomName,
  draft,
  editing,
  disabled,
  saving,
  canPost,
  onChange,
  onAddFiles,
  onSend,
  handle,
}: {
  roomName: string
  draft: ChatDraft
  editing?: { id: string; hasImages: boolean; onCancel: () => void } | undefined
  disabled: boolean
  saving: boolean
  canPost: boolean
  onChange: (draft: ChatDraft) => void
  onAddFiles: (files: ChatFile[]) => void
  onSend: () => void
  handle: RefObject<ComposerHandle | null>
}) {
  if (!canPost) return null
  return (
    <div
      data-composer-seat
      className="relative isolate px-[var(--chat-gutter)] pb-[var(--composer-bottom)]"
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
        handle={handle}
      />
    </div>
  )
}
