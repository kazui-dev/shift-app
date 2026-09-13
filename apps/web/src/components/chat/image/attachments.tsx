import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import type { ChatAttachment } from "@workspace/shared/communications"
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
export function MessageImages({
  roomId,
  images,
  onOpen,
}: {
  roomId: string
  images: ChatAttachment[]
  onOpen: (id: string) => void
}) {
  const [first] = images
  if (!first) return null
  if (images.length === 1)
    return (
      <div
        className="mt-2 max-w-full overflow-hidden rounded-xl border"
        style={imageSize(first)}
      >
        <RemoteImage
          roomId={roomId}
          id={first.id}
          width={first.width}
          height={first.height}
          alt="画像1を拡大"
          onOpen={() => onOpen(first.id)}
        />
      </div>
    )
  const tile = (image: ChatAttachment, index: number, className = "") => (
    <div
      key={image.id}
      className={`min-h-0 overflow-hidden bg-muted ${className}`}
    >
      <RemoteImage
        roomId={roomId}
        id={image.id}
        width={image.width}
        height={image.height}
        alt={`画像${index + 1}を拡大`}
        fit="cover"
        onOpen={() => onOpen(image.id)}
      />
    </div>
  )
  // Several images share one rounded frame, arranged as in the mosaic rule.
  const layout = mosaic(images.length)
  if (layout.split)
    return (
      <div className="mt-2 grid aspect-[4/3] w-full max-w-lg grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg">
        {images.map((image, index) =>
          tile(image, index, index === 0 ? "row-span-2" : "")
        )}
      </div>
    )
  let offset = 0
  return (
    <div className="mt-2 flex w-full max-w-lg flex-col gap-1 overflow-hidden rounded-lg">
      {layout.rows.map((size) => {
        const start = offset
        offset += size
        return (
          <div
            key={start}
            className={`grid gap-1 ${size === 1 ? "aspect-video grid-cols-1" : size === 2 ? "aspect-[2/1] grid-cols-2" : "aspect-[3/1] grid-cols-3"}`}
          >
            {images
              .slice(start, start + size)
              .map((image, index) => tile(image, start + index))}
          </div>
        )
      })}
    </div>
  )
}
