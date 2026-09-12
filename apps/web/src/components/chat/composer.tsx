import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { SendHorizontal, Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"
import { chatImageLimits } from "@workspace/shared/communications"
import type { ChatDraft, ChatFile } from "@/lib/chat-store"
import { LocalImage } from "./images"
import { useComposerLayout } from "./use-composer-layout"
import { useMediaQuery } from "@/hooks/use-media-query"

export function ChatComposer({
  roomName,
  draft,
  disabled,
  onChange,
  onAddFiles,
  onSend,
  editing,
}: {
  editing?: { id: string; hasImages: boolean; onCancel: () => void } | undefined
  roomName: string
  draft: ChatDraft
  disabled: boolean
  onChange: (draft: ChatDraft) => void
  onAddFiles: (files: ChatFile[]) => void
  onSend: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { input, measure, body, expanded } = useComposerLayout(
    draft.content,
    focused,
    !disabled
  )
  useEffect(() => {
    if (draft.reply?.id || editing?.id)
      input.current?.focus({ preventScroll: true })
  }, [draft.reply?.id, editing?.id, input])
  const [dragging, setDragging] = useState(false)
  const touch = useMediaQuery("(pointer: coarse)")
  const textClass =
    "min-h-0 [field-sizing:fixed] touch-pan-y resize-none overscroll-contain rounded-none border-0 bg-transparent px-10 py-1 text-base leading-6 shadow-none transition-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
  const finishPicking = useCallback(() => {
    setPickerOpen(false)
  }, [])
  useEffect(() => {
    const field = fileInput.current
    field?.addEventListener("cancel", finishPicking)
    return () => field?.removeEventListener("cancel", finishPicking)
  }, [finishPicking])
  async function addFiles(incoming: File[]) {
    if (editing) return
    if (incoming.length + draft.files.length > chatImageLimits.count) {
      toast.error("添付できる画像は10枚までです。")
      return
    }
    const accepted: ChatFile[] = []
    for (const file of incoming) {
      if (
        !/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type) &&
        !/\.(heic|heif)$/i.test(file.name)
      ) {
        toast.error("写真・画像を選択してください。")
        continue
      }
      if (file.size > chatImageLimits.bytes) {
        toast.error("画像は1枚10MBまでです。")
        continue
      }
      accepted.push({ id: crypto.randomUUID(), name: file.name, blob: file })
    }
    const readable = await Promise.all(
      accepted.map(async (selected) => {
        try {
          selected.blob = new Blob([await selected.blob.arrayBuffer()], {
            type: selected.blob.type,
          })
        } catch {
          toast.error("画像を読み込めませんでした。もう一度選択してください。")
          return null
        }
        try {
          const bitmap = await createImageBitmap(selected.blob)
          selected.dimensions = { width: bitmap.width, height: bitmap.height }
          bitmap.close()
        } catch {
          // HEIC can still be decoded by the upload service.
        }
        return selected
      })
    )
    const files = readable.filter((file) => file !== null)
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
      {draft.reply && (
        <div
          className="flex items-center gap-2 rounded-t-xl bg-muted px-3 py-2 text-xs"
          aria-label="返信先"
        >
          <span className="min-w-0 flex-1 truncate">
            {draft.reply.memberDisplayName}への返信
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="返信を取り消す"
            onClick={() => onChange({ ...draft, reply: undefined })}
          >
            <X />
          </Button>
        </div>
      )}
      {draft.files.length > 0 && (
        <div className="relative isolate before:pointer-events-none before:absolute before:-inset-x-[var(--chat-gutter)] before:inset-y-0 before:-z-10 before:bg-linear-to-b before:from-transparent before:to-background before:to-30%">
          <ul
            data-horizontal-scroll
            className="flex max-w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none]"
            aria-label="添付する画像"
          >
            {draft.files.map((file) => (
              <li
                key={file.id}
                className="relative size-20 shrink-0 overflow-hidden rounded-xl"
              >
                <LocalImage
                  blob={file.blob}
                  alt={file.name}
                  className="size-full object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute top-1 right-1 rounded-full"
                  aria-label={`${file.name}を外す`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() =>
                    onChange({
                      ...draft,
                      files: draft.files.filter((item) => item.id !== file.id),
                    })
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        ref={form}
        data-chat-composer
        aria-label="メッセージを作成"
        data-expanded={expanded}
        onSubmit={(event) => {
          event.preventDefault()
          if (
            !disabled &&
            (draft.content.trim() || draft.files.length || editing?.hasImages)
          ) {
            onSend()
          }
        }}
        className={`rounded-3xl border bg-background shadow-xs ${dragging ? "border-ring" : "border-input"}`}
      >
        {editing && (
          <div className="flex items-center justify-between px-4 pt-2 text-xs text-muted-foreground">
            <span>メッセージ編集中</span>
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="rounded-full"
              aria-label="編集を取り消す"
              disabled={disabled}
              onPointerDown={(event) => event.preventDefault()}
              onClick={editing.onCancel}
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
            className={`${editing ? "invisible" : ""} absolute bottom-2 left-2 size-8 rounded-full text-muted-foreground transition-none active:scale-95 active:bg-muted data-[pressed=true]:scale-95 data-[pressed=true]:bg-muted`}
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`${roomName}へメッセージを送信`}
            disabled={disabled}
            value={draft.content}
            enterKeyHint={touch ? "enter" : "send"}
            className={`${textClass} placeholder:truncate`}
            onChange={(event) =>
              onChange({ ...draft, content: event.currentTarget.value })
            }
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
            disabled={
              disabled ||
              (!draft.content.trim() &&
                !draft.files.length &&
                !editing?.hasImages)
            }
          >
            <SendHorizontal />
          </Button>
        </div>
      </form>
    </div>
  )
}
