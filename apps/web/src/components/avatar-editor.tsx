import { useEffect, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { ResponsiveDialog } from "@/components/responsive-overlay"
import {
  clampFrame,
  coveringScale,
  cropRect,
  initialFrame,
  midpoint,
  spread,
  zoomFrame,
  type Frame,
  type Point,
  type Size,
} from "@/lib/account/avatar-crop"

/** The side of the round preview, and of the square that is uploaded. */
const viewport = 260
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
 * Framing the picked image: it is dragged to move and pinched, scrolled or
 * dragged on the slider to zoom, and only the circle is kept.
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

  const minimum = size ? coveringScale(size, viewport) : 1
  const busy = working || pending
  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel()
      }}
      title="アイコンを調整"
      description="ドラッグで位置、ピンチやスライダーで大きさを変えられます。"
      className="sm:max-w-md"
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative touch-none overflow-hidden rounded-full bg-muted"
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
              className="absolute top-0 left-0 max-w-none origin-top-left select-none"
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
        <input
          type="range"
          aria-label="大きさ"
          className="w-full max-w-64 accent-primary"
          min={1}
          max={8}
          step={0.01}
          disabled={!frame}
          value={frame ? frame.scale / minimum : 1}
          onChange={(event) => {
            if (!frame || !size) return
            place(
              zoomFrame(
                frame,
                size,
                viewport,
                minimum * Number(event.target.value),
                { x: viewport / 2, y: viewport / 2 }
              )
            )
          }}
        />
        <div className="flex w-full gap-2">
          <Button
            className="h-11 flex-1"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            className="h-11 flex-1"
            disabled={!frame || busy}
            onClick={() => void confirm()}
          >
            {busy && <LoaderCircle className="animate-spin" />}
            決定
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
