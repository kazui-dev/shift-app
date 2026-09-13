import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import type {
  ChatAttachment,
  ChatImageSize,
} from "@workspace/shared/communications"
import type { ChatFile } from "@/lib/chat/store"
import { imagePreview } from "@/lib/chat/preview"
import { RemoteImage } from "@/components/chat/image/remote"
import {
  frameWidth,
  mosaic,
  rowAspect,
  singleImageSize,
  splitAspect,
  tileGap,
  tileSizes,
} from "@/components/chat/image/frame"

/** A picked image, shown through this device's preview of it. */
export function LocalImage({
  blob,
  alt,
  className,
}: {
  blob: Blob
  alt: string
  className?: string
}) {
  const [source, setSource] = useState<{ blob: Blob; url: string | null }>()
  useEffect(() => {
    let active = true
    let url: string | undefined
    void imagePreview(blob)
      .then(async (preview) => {
        if (!preview) throw new Error("This device cannot decode the image")
        const value = URL.createObjectURL(preview.blob)
        url = value
        const image = new Image()
        image.src = value
        await image.decode()
        if (active) setSource({ blob, url: value })
      })
      .catch(() => {
        if (active) setSource({ blob, url: null })
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [blob])
  if (source?.blob !== blob) return null
  return source.url === null ? (
    <span
      className={`flex items-center justify-center bg-muted ${className}`}
      title={alt}
    >
      <ImageIcon className="size-5 text-muted-foreground" aria-label={alt} />
    </span>
  ) : (
    <img
      src={source.url}
      alt={alt}
      className={className}
      onError={() => setSource({ blob, url: null })}
    />
  )
}

type FrameImage = {
  key: string
  dimensions: { width: number; height: number } | undefined
} & (
  | {
      kind: "remote"
      roomId: string
      id: string
      tile: ChatImageSize
      label: string
      onOpen: () => void
    }
  | { kind: "pending"; file: ChatFile }
)

function FrameContent({
  image,
  fit,
}: {
  image: FrameImage
  fit: "contain" | "cover"
}) {
  return image.kind === "remote" ? (
    <RemoteImage
      roomId={image.roomId}
      id={image.id}
      size={image.tile}
      width={image.dimensions?.width ?? 0}
      height={image.dimensions?.height ?? 0}
      alt={image.label}
      fit={fit}
      onOpen={image.onOpen}
    />
  ) : (
    <LocalImage
      blob={image.file.blob}
      alt={image.file.name}
      className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
    />
  )
}

/**
 * One image keeps its own proportions; several share one rounded frame,
 * arranged by the mosaic rule. Sent and still-sending images use the same frame.
 */
function ImageFrame({ images }: { images: FrameImage[] }) {
  const [first] = images
  if (!first) return null
  if (images.length === 1)
    return (
      <div
        data-message-media
        className="mt-2 max-w-full overflow-hidden rounded-lg"
        style={singleImageSize(first.dimensions)}
      >
        <FrameContent image={first} fit="contain" />
      </div>
    )
  const tile = (image: FrameImage, className = "") => (
    <div
      key={image.key}
      className={`relative min-h-0 min-w-0 overflow-hidden bg-muted ${className}`}
    >
      {/* Positioned so a loaded image can never resize its tile. */}
      <div className="absolute inset-0">
        <FrameContent image={image} fit="cover" />
      </div>
    </div>
  )
  const layout = mosaic(images.length)
  // Sized from the frame module, which the history's warming measures too.
  const frame = { maxWidth: frameWidth, gap: tileGap }
  if (layout.split)
    return (
      <div
        data-message-media
        className="mt-2 grid w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-lg"
        style={{ ...frame, aspectRatio: splitAspect }}
      >
        {images.map((image, index) =>
          tile(image, index === 0 ? "row-span-2" : "")
        )}
      </div>
    )
  let offset = 0
  return (
    <div
      data-message-media
      className="mt-2 flex w-full flex-col overflow-hidden rounded-lg"
      style={frame}
    >
      {layout.rows.map((size) => {
        const start = offset
        offset += size
        return (
          <div
            key={start}
            className="grid grid-rows-[minmax(0,1fr)]"
            style={{
              gap: tileGap,
              aspectRatio: rowAspect(size),
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            }}
          >
            {images.slice(start, start + size).map((image) => tile(image))}
          </div>
        )
      })}
    </div>
  )
}

export function MessageImages({
  roomId,
  images,
  onOpen,
}: {
  roomId: string
  images: ChatAttachment[]
  onOpen: (id: string) => void
}) {
  const sizes = tileSizes(images.length)
  return (
    <ImageFrame
      images={images.map((image, index) => ({
        kind: "remote" as const,
        key: image.id,
        dimensions: image,
        roomId,
        id: image.id,
        tile: sizes[index] ?? 640,
        label: `画像${index + 1}を拡大`,
        onOpen: () => onOpen(image.id),
      }))}
    />
  )
}

/** Images of a message that is still sending, framed as they will be once sent. */
export function PendingImages({ files }: { files: ChatFile[] }) {
  return (
    <ImageFrame
      images={files.map((file) => ({
        kind: "pending" as const,
        key: file.id,
        dimensions: file.uploaded ?? file.dimensions,
        file,
      }))}
    />
  )
}
