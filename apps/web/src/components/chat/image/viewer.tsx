import { useEffect, useRef, useState } from "react"
import { japanTimestamp } from "@workspace/shared/japan-time"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { Minus, Plus, Download, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { MemberAvatar } from "@/components/member-avatar"
import {
  initialImageView,
  limitImageView,
  zoomImage,
  type Point,
} from "@/components/chat/image/zoom"

export function ImageViewer({
  src,
  width,
  height,
  onClose,
  caption,
}: {
  src: string
  width: number
  height: number
  onClose: () => void
  caption: {
    author: string
    image: string | null
    content: string
    createdAt: string
  }
}) {
  const frame = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const current = useRef(initialImageView)
  const [view, setView] = useState(initialImageView)
  useEffect(() => {
    const element = frame.current
    if (!element) return undefined
    const observer = new ResizeObserver(() => {
      pointers.current.clear()
      current.current = initialImageView
      setView(initialImageView)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  function update(next: typeof view) {
    const bounds = frame.current?.getBoundingClientRect()
    if (!bounds) return
    const fit = Math.min(bounds.width / width, bounds.height / height)
    const value = limitImageView(
      next,
      bounds.width,
      bounds.height,
      width * fit,
      height * fit
    )
    current.current = value
    setView(value)
  }
  function magnify(factor: number) {
    update(
      zoomImage(current.current, current.current.scale * factor, { x: 0, y: 0 })
    )
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black/95 p-0 text-white ring-0 duration-0 sm:max-w-none data-open:animate-none data-closed:animate-none"
      >
        <DialogTitle className="sr-only">
          {caption.author}の添付画像
        </DialogTitle>
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex items-start justify-between px-3 md:justify-end md:gap-3">
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="画像を閉じる"
                className="pointer-events-auto size-11 rounded-full bg-black/65 text-white hover:bg-white/20 md:order-last"
              />
            }
          >
            <X />
          </DialogClose>
          <div className="pointer-events-auto flex items-center rounded-full bg-black/65 p-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="縮小"
              className="hidden text-white hover:bg-white/20 md:inline-flex"
              disabled={view.scale === 1}
              onClick={() => magnify(1 / 1.5)}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="拡大"
              className="hidden text-white hover:bg-white/20 md:inline-flex"
              disabled={view.scale === 5}
              onClick={() => magnify(1.5)}
            >
              <Plus />
            </Button>
            <a
              href={src}
              download="chat-image.webp"
              aria-label="画像を保存"
              className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/20"
            >
              <Download className="size-5" />
            </a>
          </div>
        </div>
        <div
          ref={frame}
          className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
          onPointerDown={(event) => {
            if (event.button !== 0 || pointers.current.size >= 2) return
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            })
          }}
          onPointerMove={(event) => {
            const previous = pointers.current.get(event.pointerId)
            if (!previous) return
            const next = { x: event.clientX, y: event.clientY }
            const other = [...pointers.current].find(
              ([id]) => id !== event.pointerId
            )?.[1]
            pointers.current.set(event.pointerId, next)
            if (other) {
              const distance = Math.hypot(
                previous.x - other.x,
                previous.y - other.y
              )
              if (distance < 1) return
              const bounds = event.currentTarget.getBoundingClientRect()
              const midpoint = (point: Point) => ({
                x: (point.x + other.x) / 2 - bounds.left - bounds.width / 2,
                y: (point.y + other.y) / 2 - bounds.top - bounds.height / 2,
              })
              update(
                zoomImage(
                  current.current,
                  (current.current.scale *
                    Math.hypot(next.x - other.x, next.y - other.y)) /
                    distance,
                  midpoint(previous),
                  midpoint(next)
                )
              )
            } else {
              update({
                ...current.current,
                x: current.current.x + next.x - previous.x,
                y: current.current.y + next.y - previous.y,
              })
            }
          }}
          onLostPointerCapture={(event) =>
            pointers.current.delete(event.pointerId)
          }
          onPointerUp={(event) => pointers.current.delete(event.pointerId)}
          onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
        >
          <img
            src={src}
            alt="添付画像"
            draggable={false}
            className="pointer-events-none size-full object-contain"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          />
        </div>
        <div className="flex max-h-[25dvh] shrink-0 items-start gap-3 overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] text-sm">
          <MemberAvatar
            name={caption.author}
            image={caption.image}
            className="size-9 bg-white/15 text-white"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold">{caption.author}</span>
              <time
                className="text-xs text-white/60"
                dateTime={caption.createdAt}
              >
                {japanTimestamp(caption.createdAt)}
              </time>
            </div>
            {caption.content && (
              <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">
                {caption.content}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
