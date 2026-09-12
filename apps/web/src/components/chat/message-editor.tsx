import { useLayoutEffect, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

export function MessageEditor({
  content,
  pending,
  hasImages,
  onChange,
  onSave,
  onCancel,
}: {
  content: string
  pending: boolean
  hasImages: boolean
  onChange: (value: string) => void
  onSave: (value: string) => void
  onCancel: () => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const measure = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = input.current
    if (!field) return
    field.focus({ preventScroll: true })
    field.setSelectionRange(field.value.length, field.value.length)
  }, [])
  useLayoutEffect(() => {
    const field = input.current,
      sizer = measure.current
    if (!field || !sizer) return undefined
    const resize = () => {
      field.style.height = `${Math.max(28, Math.min(sizer.scrollHeight, 224))}px`
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(sizer)
    return () => observer.disconnect()
  }, [content])
  const textClass =
    "min-h-0 w-full resize-none rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-7 shadow-none [field-sizing:fixed] focus-visible:ring-0 dark:bg-transparent"
  return (
    <form
      className="relative max-w-[85ch] pb-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(input.current?.value ?? content)
      }}
    >
      <Textarea
        ref={input}
        value={content}
        rows={1}
        maxLength={2000}
        aria-label="メッセージを編集"
        disabled={pending}
        className={textClass}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return
          if (event.key === "Escape") {
            event.preventDefault()
            onCancel()
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <Textarea
        ref={measure}
        value={content}
        readOnly
        tabIndex={-1}
        aria-hidden
        rows={1}
        className={`${textClass} pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden`}
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending || (!content.trim() && !hasImages)}
        >
          保存
        </Button>
      </div>
    </form>
  )
}
