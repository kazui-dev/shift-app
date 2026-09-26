import { useEffect, useRef, useState } from "react"
import { Check, LoaderCircle, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import {
  circleSide,
  clampFrame,
  cropRect,
  initialFrame,
  midpoint,
  spread,
  zoomFrame,
  type Frame,
  type Point,
  type Size,
} from "@/features/account/lib/avatar-crop"

/** The side of the square that is uploaded; the server keeps a smaller one. */
const output = 512

/** The screen the circle is measured against, read before the first paint. */
function screen(): Size {
  return { width: window.innerWidth, height: window.innerHeight }
}

/** The visible square of the source, drawn at the size the server keeps. */
async function cropped(
  image: HTMLImageElement,
  frame: Frame,
  circle: number
): Promise<Blob> {
  const rect = cropRect(frame, circle)
  const canvas = document.createElement("canvas")
  canvas.width = output
  canvas.height = output
  const context = canvas.getContext("2d")
  if (!context) throw new Error("画像を切り抜けませんでした。")
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.size,
    rect.size,
    0,
    0,
    output,
    output
  )
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  )
  if (!blob) throw new Error("画像を切り抜けませんでした。")
  return blob
}

/**
 * Framing the picked image over the whole screen: the ring marks what the icon
 * becomes, everything outside it is dimmed, and the image is dragged and
 * pinched directly. Nothing is written on it but the two controls.
 */
export function AvatarEditor({
  file,
  pending,
  onCancel,
  onDone,
}: {
  file: File
  pending: boolean
  onCancel: () => void
  onDone: (image: Blob) => void
}) {
  // Measured before the first paint so the image is placed once, without a jump.
  const [area, setArea] = useState(screen)
  const [source, setSource] = useState<string | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [frame, setFrame] = useState<Frame | null>(null)
  const [working, setWorking] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ spread: number; scale: number } | null>(null)
  const circle = circleSide(area.width, area.height)
  const origin = {
    x: (area.width - circle) / 2,
    y: (area.height - circle) / 2,
  }

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSource(url)
    setSize(null)
    setFrame(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const measure = () => {
      const next = screen()
      setArea((previous) => {
        if (previous.width === next.width && previous.height === next.height)
          return previous
        const side = circleSide(next.width, next.height)
        const ratio = side / circleSide(previous.width, previous.height)
        // Keep the same part of the image framed as the screen changes.
        if (Number.isFinite(ratio) && ratio > 0)
          setFrame((current) =>
            current
              ? {
                  scale: current.scale * ratio,
                  x: current.x * ratio,
                  y: current.y * ratio,
                }
              : current
          )
        return next
      })
    }
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  const place = (next: Frame) => {
    if (size && circle > 0) setFrame(clampFrame(next, size, circle))
  }
  const positions = () => [...pointers.current.values()]

  function down(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    gesture.current = null
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!frame || !size || !pointers.current.has(event.pointerId)) return
    const previous = positions()
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    const current = positions()
    const [first, second] = current
    if (first && second && previous[0] && previous[1]) {
      const distance = spread(first, second)
      const start = gesture.current ?? { spread: distance, scale: frame.scale }
      gesture.current = start
      const centre = midpoint(first, second)
      place(
        zoomFrame(
          frame,
          size,
          circle,
          (start.scale * distance) / start.spread,
          {
            x: centre.x - origin.x,
            y: centre.y - origin.y,
          }
        )
      )
      return
    }
    const from = previous[0]
    const to = current[0]
    if (!from || !to) return
    place({
      ...frame,
      x: frame.x + (to.x - from.x),
      y: frame.y + (to.y - from.y),
    })
  }

  function up(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) gesture.current = null
  }

  async function confirm() {
    if (!frame || !image.current || working) return
    setWorking(true)
    try {
      onDone(await cropped(image.current, frame, circle))
    } finally {
      setWorking(false)
    }
  }

  const busy = working || pending
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel()
      }}
    >
      <DialogContent
        showCloseButton={false}
        // The viewer's fullscreen shell: no animation, so nothing flashes.
        className="inset-0 top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none bg-black/95 p-0 text-white ring-0 duration-0 sm:max-w-none data-open:animate-none data-closed:animate-none"
      >
        <DialogTitle className="sr-only">アイコンの位置と大きさ</DialogTitle>
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(event) => {
            if (!frame || !size) return
            place(
              zoomFrame(
                frame,
                size,
                circle,
                frame.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
                { x: event.clientX - origin.x, y: event.clientY - origin.y }
              )
            )
          }}
        >
          {source && (
            <img
              ref={image}
              src={source}
              alt=""
              draggable={false}
              className="absolute top-0 left-0 max-w-none origin-top-left"
              style={
                frame
                  ? {
                      transform: `translate(${origin.x + frame.x}px, ${origin.y + frame.y}px) scale(${frame.scale})`,
                    }
                  : { visibility: "hidden" }
              }
              onLoad={(event) => {
                const measured = {
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                }
                setSize(measured)
                setFrame(initialFrame(measured, circle))
              }}
            />
          )}
          {circle > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-full ring-2 ring-white/80"
              style={{
                left: origin.x,
                top: origin.y,
                width: circle,
                height: circle,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.62)",
              }}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-8 px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto size-14 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="やめる"
            disabled={busy}
            onClick={onCancel}
          >
            <X className="size-6" />
          </Button>
          <Button
            size="icon"
            className="pointer-events-auto size-14 rounded-full"
            aria-label="この位置で決定"
            disabled={!frame || busy}
            onClick={() => void confirm()}
          >
            {busy ? (
              <LoaderCircle className="size-6 animate-spin" />
            ) : (
              <Check className="size-6" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
