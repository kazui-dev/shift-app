import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import type { ChatAttachment } from "@workspace/shared/communications"
import { chatImageUrl } from "@/api/chat"
import { ImageViewer } from "./image-viewer"
import { imageSize } from "./image-size"

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
}: {
  roomId: string
  images: ChatAttachment[]
}) {
  const [opened, setOpened] = useState<ChatAttachment | null>(null)
  if (!images.length) return null
  return (
    <>
      <div
        className={`mt-2 grid max-w-lg gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {images.map((image, index) => (
          <button
            key={image.id}
            data-page-swipe
            type="button"
            onClick={() => setOpened(image)}
            aria-label={`画像${index + 1}を拡大`}
            className="max-w-full overflow-hidden rounded-xl border text-left"
            style={imageSize(image)}
          >
            <img
              src={chatImageUrl(roomId, image.id)}
              width={image.width}
              height={image.height}
              alt={`添付画像 ${index + 1}`}
              loading="lazy"
              draggable={false}
              className="size-full object-contain"
            />
          </button>
        ))}
      </div>
      {opened && (
        <ImageViewer
          src={chatImageUrl(roomId, opened.id)}
          width={opened.width}
          height={opened.height}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  )
}
