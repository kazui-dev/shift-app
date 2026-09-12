import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { Minus, Plus, RotateCcw, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  initialImageView,
  limitImageView,
  zoomImage,
  type Point,
} from "./image-zoom"

export function ImageViewer({
  src,
  width,
  height,
  onClose,
}: {
  src: string
  width: number
  height: number
  onClose: () => void
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
        className="inset-0 top-0 left-0 flex h-dvh min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:max-w-none"
      >
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
          <DialogTitle className="mr-auto font-semibold">画像</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            aria-label="縮小"
            disabled={view.scale === 1}
            onClick={() => magnify(1 / 1.5)}
          >
            <Minus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="拡大"
            disabled={view.scale === 5}
            onClick={() => magnify(1.5)}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="拡大をリセット"
            onClick={() => update(initialImageView)}
          >
            <RotateCcw />
          </Button>
          <DialogClose
            render={
              <Button variant="ghost" size="icon" aria-label="画像を閉じる" />
            }
          >
            <X />
          </DialogClose>
        </header>
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
      </DialogContent>
    </Dialog>
  )
}
