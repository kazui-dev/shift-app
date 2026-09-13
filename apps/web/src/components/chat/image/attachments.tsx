import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import type { ChatAttachment } from "@workspace/shared/communications"
import type { ChatFile } from "@/lib/chat/store"
import { RemoteImage } from "@/components/chat/image/remote"
import { imageSize } from "@/components/chat/image/size"
import { mosaic } from "@/components/chat/image/mosaic"

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
    const value = URL.createObjectURL(blob)
    let active = true
    const image = new Image()
    image.src = value
    void image
      .decode()
      .then(() => {
        if (active) setSource({ blob, url: value })
      })
      .catch(() => {
        if (active) setSource({ blob, url: null })
      })
    return () => {
      active = false
      URL.revokeObjectURL(value)
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
type FrameImage =
  | {
      kind: "remote"
      key: string
      size: ChatAttachment
      roomId: string
      label: string
      onOpen: () => void
    }
  | {
      kind: "pending"
      key: string
      size: { width: number; height: number } | undefined
      file: ChatFile
    }

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
      id={image.size.id}
      width={image.size.width}
      height={image.size.height}
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
        style={imageSize(first.size)}
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
  if (layout.split)
    return (
      <div
        data-message-media
        className="mt-2 grid aspect-[4/3] w-full max-w-lg grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg"
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
      className="mt-2 flex w-full max-w-lg flex-col gap-1 overflow-hidden rounded-lg"
    >
      {layout.rows.map((size) => {
        const start = offset
        offset += size
        return (
          <div
            key={start}
            className={`grid grid-rows-[minmax(0,1fr)] gap-1 ${size === 1 ? "aspect-video grid-cols-1" : size === 2 ? "aspect-[2/1] grid-cols-2" : "aspect-[3/1] grid-cols-3"}`}
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
  return (
    <ImageFrame
      images={images.map((image, index) => ({
        kind: "remote" as const,
        key: image.id,
        size: image,
        roomId,
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
        size: file.uploaded ?? file.dimensions,
        file,
      }))}
    />
  )
}
