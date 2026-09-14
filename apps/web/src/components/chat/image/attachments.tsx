import { useLayoutEffect, useState, type ReactNode } from "react"
import { ImageIcon } from "lucide-react"
import type {
  ChatAttachment,
  ChatImageSize,
} from "@workspace/shared/communications"
import type { ChatFile, UploadProgress } from "@/lib/chat/store"
import { RemoteImage } from "@/components/chat/image/remote"
import { UploadOverlay } from "@/components/chat/image/upload-progress"
import {
  frameWidth,
  mosaic,
  rowAspect,
  singleImageSize,
  splitAspect,
  tileGap,
  tileSizes,
} from "@/components/chat/image/frame"

/** Object URLs of picked images, shared by every place one shows at once. */
const localUrls = new Map<Blob, { url: string; users: number }>()

function acquireUrl(blob: Blob) {
  const entry = localUrls.get(blob) ?? {
    url: URL.createObjectURL(blob),
    users: 0,
  }
  entry.users += 1
  localUrls.set(blob, entry)
  return entry.url
}

function releaseUrl(blob: Blob) {
  const entry = localUrls.get(blob)
  if (!entry || --entry.users > 0) return
  localUrls.delete(blob)
  URL.revokeObjectURL(entry.url)
}

/**
 * A picked image, shown from the file itself in the frame it is placed in, so
 * it appears the moment it is attached. The browser decodes it off the main
 * thread; the rail and the sending message share one URL and one decode.
 */
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
  // Before paint, so the image never shows a frame without its source.
  useLayoutEffect(() => {
    setSource({ blob, url: acquireUrl(blob) })
    return () => releaseUrl(blob)
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
      decoding="async"
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
  | {
      kind: "pending"
      file: ChatFile
      progress: UploadProgress | undefined
    }
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
    <>
      <LocalImage
        blob={image.file.blob}
        alt={image.file.name}
        className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
      />
      <UploadOverlay progress={image.progress} name={image.file.name} />
    </>
  )
}

/**
 * One image keeps its own proportions; several share one rounded frame,
 * arranged by the mosaic rule. Sent and still-sending images use the same frame.
 */
function ImageFrame({
  images,
  badge,
}: {
  images: FrameImage[]
  /** A mark over the frame's corner, as on an image that failed to send. */
  badge?: ReactNode
}) {
  const [first] = images
  if (!first) return null
  if (images.length === 1)
    return (
      <div
        data-message-media
        className="relative mt-2 max-w-full overflow-hidden rounded-lg"
        style={singleImageSize(first.dimensions)}
      >
        <FrameContent image={first} fit="contain" />
        {badge}
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
        className="relative mt-2 grid w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-lg"
        style={{ ...frame, aspectRatio: splitAspect }}
      >
        {images.map((image, index) =>
          tile(image, index === 0 ? "row-span-2" : "")
        )}
        {badge}
      </div>
    )
  let offset = 0
  return (
    <div
      data-message-media
      className="relative mt-2 flex w-full flex-col overflow-hidden rounded-lg"
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
      {badge}
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
        label: image.name,
        onOpen: () => onOpen(image.id),
      }))}
    />
  )
}

/** Images of a message that is still sending, framed as they will be once sent. */
export function PendingImages({
  files,
  uploads,
  badge,
}: {
  files: ChatFile[]
  uploads: Record<string, UploadProgress>
  badge?: ReactNode
}) {
  return (
    <ImageFrame
      badge={badge}
      images={files.map((file) => ({
        kind: "pending" as const,
        key: file.id,
        dimensions: file.uploaded ?? file.dimensions,
        file,
        progress: uploads[file.id],
      }))}
    />
  )
}
