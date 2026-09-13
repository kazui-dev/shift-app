import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { SendHorizontal, Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import type { ChatDraft, ChatFile } from "@/lib/chat/store"
import { attachImages } from "@/components/chat/composer/attach-images"
import { ComposerAttachments } from "@/components/chat/composer/attachments"
import { useComposerLayout } from "@/components/chat/composer/use-layout"
import { canSubmit } from "@/components/chat/composer/send-rule"
import { useMediaQuery } from "@/hooks/use-media-query"

export function ChatComposer({
  roomName,
  draft,
  disabled,
  saving = false,
  onChange,
  onAddFiles,
  onSend,
  editing,
  focusRequest,
}: {
  editing?: { id: string; hasImages: boolean; onCancel: () => void } | undefined
  roomName: string
  draft: ChatDraft
  disabled: boolean
  saving?: boolean
  onChange: (draft: ChatDraft) => void
  onAddFiles: (files: ChatFile[]) => void
  onSend: () => void
  /** Increments each time the member picks a message to reply to or edit. */
  focusRequest: number
}) {
  const form = useRef<HTMLFormElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pressed, setPressed] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { input, measure, body, expanded } = useComposerLayout(
    draft.content,
    !disabled
  )
  // Focus follows the member choosing to reply or edit. Ending, cancelling or
  // restoring a mode leaves focus, and therefore the mobile keyboard, alone.
  useEffect(() => {
    if (focusRequest) input.current?.focus({ preventScroll: true })
  }, [focusRequest, input])
  const sendable = canSubmit(draft, editing)
  const mode = editing
    ? {
        label: "メッセージ編集中",
        cancelLabel: "編集を取り消す",
        cancel: editing.onCancel,
      }
    : draft.reply
      ? {
          label: `${draft.reply.memberDisplayName}への返信`,
          cancelLabel: "返信を取り消す",
          cancel: () =>
            onChange({ content: draft.content, files: draft.files }),
        }
      : null
  const cancelMode = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.isComposing ||
      disabled ||
      saving
    )
      return
    if (
      event.target instanceof Element &&
      event.target.closest(
        '[role="dialog"],[role="alertdialog"],[role="listbox"]'
      )
    )
      return
    event.preventDefault()
    mode?.cancel()
  })
  const modeActive = mode !== null
  useEffect(() => {
    if (!modeActive) return undefined
    const key = (event: KeyboardEvent) => cancelMode(event)
    document.addEventListener("keydown", key)
    return () => document.removeEventListener("keydown", key)
  }, [modeActive])
  const [dragging, setDragging] = useState(false)
  const touch = useMediaQuery("(pointer: coarse)")
  const textClass =
    "min-h-0 [field-sizing:fixed] touch-pan-y resize-none overscroll-contain rounded-none border-0 bg-transparent px-10 py-1 text-base leading-6 shadow-none transition-none md:text-sm dark:bg-transparent"
  const finishPicking = useCallback(() => {
    setPickerOpen(false)
  }, [])
  useEffect(() => {
    const field = fileInput.current
    field?.addEventListener("cancel", finishPicking)
    return () => field?.removeEventListener("cancel", finishPicking)
  }, [finishPicking])
  async function addFiles(incoming: File[]) {
    const files = await attachImages(incoming, draft.files.length)
    if (files.length) onAddFiles(files)
  }
  const receiveDrop = useEffectEvent((event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled && event.dataTransfer)
      void addFiles(Array.from(event.dataTransfer.files))
  })
  useEffect(() => {
    const element = form.current
    if (!element) return undefined
    function over(event: DragEvent) {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault()
        setDragging(true)
      }
    }
    function leave(event: DragEvent) {
      if (
        !(event.relatedTarget instanceof Node) ||
        !element?.contains(event.relatedTarget)
      )
        setDragging(false)
    }
    function drop(event: DragEvent) {
      receiveDrop(event)
    }
    element.addEventListener("dragover", over)
    element.addEventListener("dragleave", leave)
    element.addEventListener("drop", drop)
    return () => {
      element.removeEventListener("dragover", over)
      element.removeEventListener("dragleave", leave)
      element.removeEventListener("drop", drop)
    }
  }, [])
  return (
    <div className="min-w-0">
      <ComposerAttachments
        files={draft.files}
        onRemove={(id) =>
          onChange({
            ...draft,
            files: draft.files.filter((item) => item.id !== id),
          })
        }
      />
      <form
        ref={form}
        data-chat-composer
        aria-label="メッセージを作成"
        data-expanded={expanded}
        onPointerDown={(event) => {
          if (
            disabled ||
            !event.isPrimary ||
            event.button !== 0 ||
            !(event.target instanceof Element) ||
            event.target.closest("textarea,input,button,a")
          )
            return
          event.preventDefault()
          input.current?.focus({ preventScroll: true })
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled && !saving && sendable) {
            onSend()
          }
        }}
        className={`rounded-3xl border bg-background shadow-xs ${dragging ? "border-ring" : "border-input"}`}
      >
        {mode && (
          <div
            aria-label={editing ? "編集中" : "返信先"}
            className="flex items-center gap-3 px-4 pt-2 text-xs text-muted-foreground"
          >
            <span className="min-w-0 flex-1 truncate">{mode.label}</span>
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="rounded-full"
              aria-label={mode.cancelLabel}
              disabled={disabled || saving}
              onPointerDown={(event) => event.preventDefault()}
              onClick={mode.cancel}
            >
              <X />
            </Button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
            finishPicking()
          }}
        />
        <div
          ref={body}
          className="relative h-12 overflow-hidden px-2 pt-2 transition-[height] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            className={`absolute bottom-2 left-2 size-8 rounded-full text-muted-foreground transition-none active:scale-95 active:bg-muted data-[pressed=true]:scale-95 data-[pressed=true]:bg-muted`}
            data-pressed={pressed || pickerOpen}
            onPointerDown={(event) => {
              event.preventDefault()
              setPressed(true)
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            aria-label="画像を添付"
            title="画像を添付"
            onClick={() => {
              setPickerOpen(true)
              fileInput.current?.click()
            }}
          >
            <Plus />
          </Button>
          <Textarea
            ref={input}
            rows={1}
            maxLength={2000}
            aria-label={editing ? "メッセージを編集" : "メッセージ"}
            placeholder={`${roomName}へメッセージを送信`}
            disabled={disabled}
            value={draft.content}
            enterKeyHint={touch ? "enter" : "send"}
            className={`${textClass} placeholder:truncate`}
            onBeforeInput={(event) => {
              if (saving) event.preventDefault()
            }}
            onChange={(event) => {
              if (!saving)
                onChange({ ...draft, content: event.currentTarget.value })
            }}
            onPaste={(event) => {
              const images = Array.from(event.clipboardData.files)
              if (images.length) {
                event.preventDefault()
                void addFiles(images)
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229 &&
                !touch
              ) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <Textarea
            ref={measure}
            aria-hidden="true"
            tabIndex={-1}
            readOnly
            value={draft.content}
            rows={1}
            className={`${textClass} pointer-events-none invisible absolute inset-x-2 top-2 h-0 w-[calc(100%-1rem)] overflow-hidden`}
          />
          <Button
            type="submit"
            onPointerDown={(event) => event.preventDefault()}
            size="icon-sm"
            className={`absolute right-2 bottom-2 size-8 rounded-full transition-colors ${!editing && !draft.content.trim() && !draft.files.length ? "invisible" : ""}`}
            aria-label={editing ? "保存" : "送信"}
            disabled={disabled || saving || !sendable}
          >
            <SendHorizontal />
          </Button>
        </div>
      </form>
    </div>
  )
}
