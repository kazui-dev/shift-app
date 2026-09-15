import { useEffect, useRef, useState } from "react"
import { Check, LoaderCircle, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import { useMediaQuery } from "@/hooks/use-media-query"
import {
  clampFrame,
  cropRect,
  initialFrame,
  midpoint,
  spread,
  zoomFrame,
  type Frame,
  type Point,
  type Size,
} from "@/lib/account/avatar-crop"

/** The circle the member frames the image in, and the square that is kept. */
const viewport = 256
const output = 512

/** The visible square of the source, drawn at the size the server keeps. */
async function cropped(image: HTMLImageElement, frame: Frame): Promise<Blob> {
  const rect = cropRect(frame, viewport)
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
 * Framing the picked image. The circle shows exactly what the icon becomes:
 * dragging moves the image behind it, pinching or scrolling sizes it, and the
 * two controls are the only thing to read.
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
  const desktop = useMediaQuery("(min-width: 768px)")
  const [source, setSource] = useState<string | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [frame, setFrame] = useState<Frame | null>(null)
  const [working, setWorking] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ spread: number; scale: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSource(url)
    setSize(null)
    setFrame(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const place = (next: Frame) => {
    if (size) setFrame(clampFrame(next, size, viewport))
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
      const box = event.currentTarget.getBoundingClientRect()
      const centre = midpoint(first, second)
      place(
        zoomFrame(
          frame,
          size,
          viewport,
          (start.scale * distance) / start.spread,
          {
            x: centre.x - box.left,
            y: centre.y - box.top,
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
      onDone(await cropped(image.current, frame))
    } finally {
      setWorking(false)
    }
  }

  const busy = working || pending
  const body = (
    <div className="flex flex-col items-center gap-6 px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div
        // The drawer must not read framing the image as a swipe to dismiss.
        data-base-ui-swipe-ignore=""
        className="relative touch-none overflow-hidden rounded-full bg-muted select-none"
        style={{ width: viewport, height: viewport }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(event) => {
          if (!frame || !size) return
          const box = event.currentTarget.getBoundingClientRect()
          place(
            zoomFrame(
              frame,
              size,
              viewport,
              frame.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
              { x: event.clientX - box.left, y: event.clientY - box.top }
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
                    transform: `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`,
                  }
                : { visibility: "hidden" }
            }
            onLoad={(event) => {
              const measured = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              }
              setSize(measured)
              setFrame(initialFrame(measured, viewport))
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-full"
          aria-label="やめる"
          disabled={busy}
          onClick={onCancel}
        >
          <X className="size-5" />
        </Button>
        <Button
          size="icon"
          className="size-12 rounded-full"
          aria-label="この位置で決定"
          disabled={!frame || busy}
          onClick={() => void confirm()}
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <Check className="size-5" />
          )}
        </Button>
      </div>
    </div>
  )
  const title = "アイコンの位置と大きさ"
  const dismiss = (next: boolean) => {
    if (!next && !busy) onCancel()
  }

  if (desktop) {
    return (
      <Dialog open onOpenChange={dismiss}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 p-0 sm:max-w-sm"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open onOpenChange={dismiss}>
      <DrawerContent finalFocus={false}>
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {body}
      </DrawerContent>
    </Drawer>
  )
}
