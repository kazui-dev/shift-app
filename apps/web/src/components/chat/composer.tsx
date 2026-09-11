import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { ArrowUp, Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"
import { chatImageLimits } from "@workspace/shared/communications"
import type { ChatDraft, ChatFile } from "@/lib/chat-store"
import { LocalImage } from "./images"
import { useMediaQuery } from "@/hooks/use-media-query"

export function ChatComposer({
  draft,
  disabled,
  onChange,
  onSend,
}: {
  draft: ChatDraft
  disabled: boolean
  onChange: (draft: ChatDraft) => void
  onSend: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null)
  const [bodyHeight, setBodyHeight] = useState(48)
  const [expanded, setExpanded] = useState(false),
    [dragging, setDragging] = useState(false)
  const touch = useMediaQuery("(pointer: coarse)")
  useLayoutEffect(() => {
    const field = input.current
    if (!field) return undefined
    let width = field.clientWidth
    const measure = () => {
      field.style.height = "auto"
      const height = field.scrollHeight
      const bounded = Math.max(32, Math.min(height, 168))
      field.style.height = `${bounded}px`
      setBodyHeight(bounded + 8 + (expanded ? 44 : 8))
      if (draft.content && (draft.content.includes("\n") || height > 32))
        setExpanded(true)
      else if (!draft.content) setExpanded(false)
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return
      width = field.clientWidth
      measure()
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [draft.content, expanded])
  function addFiles(incoming: File[]) {
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
    if (draft.files.length + accepted.length > chatImageLimits.count) {
      toast.error("画像は1回に4枚まで添付できます。")
      return
    }
    onChange({ ...draft, files: [...draft.files, ...accepted] })
  }
  const receiveDrop = useEffectEvent((event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled && event.dataTransfer)
      addFiles(Array.from(event.dataTransfer.files))
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
    <form
      ref={form}
      data-chat-composer
      aria-label="メッセージを作成"
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled && (draft.content.trim() || draft.files.length)) {
          onSend()
          setExpanded(false)
          input.current?.focus({ preventScroll: true })
        }
      }}
      className={`rounded-3xl border bg-background shadow-xs ${dragging ? "border-ring" : "border-input"}`}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif"
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ""
        }}
      />
      {draft.files.length > 0 && (
        <ul
          className="flex gap-2 overflow-x-auto px-3 pt-3"
          aria-label="添付する画像"
        >
          {draft.files.map((file) => (
            <li
              key={file.id}
              className="relative size-20 shrink-0 overflow-hidden rounded-xl border"
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
      )}
      <div
        style={{ height: bodyHeight }}
        className={`relative px-2 pt-2 transition-[height,padding-bottom] duration-200 ease-out motion-reduce:transition-none ${expanded ? "pb-11" : "pb-2"}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          className="absolute bottom-2 left-2 size-8 rounded-full text-muted-foreground"
          aria-label="画像を添付"
          title="画像を添付"
          onClick={() => fileInput.current?.click()}
        >
          <Plus />
        </Button>
        <Textarea
          ref={input}
          rows={1}
          maxLength={2000}
          aria-label="メッセージ"
          placeholder={dragging ? "画像をドロップ" : "メッセージを入力…"}
          disabled={disabled}
          value={draft.content}
          enterKeyHint={touch ? "enter" : "send"}
          className={`min-h-0 touch-pan-y touch-pinch-zoom resize-none overscroll-contain rounded-none border-0 bg-transparent py-1 text-base leading-6 shadow-none transition-[padding] duration-200 ease-out focus-visible:ring-0 motion-reduce:transition-none md:text-sm dark:bg-transparent ${expanded ? "px-1" : "px-10"}`}
          onChange={(event) => {
            const content = event.currentTarget.value
            if (!content) setExpanded(false)
            else if (event.currentTarget.scrollHeight > 32) setExpanded(true)
            onChange({ ...draft, content })
          }}
          onPaste={(event) => {
            const images = Array.from(event.clipboardData.files)
            if (images.length) {
              event.preventDefault()
              addFiles(images)
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
        <Button
          type="submit"
          size="icon-sm"
          className="absolute right-2 bottom-2 size-8 rounded-full"
          aria-label="送信"
          disabled={disabled || (!draft.content.trim() && !draft.files.length)}
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  )
}
