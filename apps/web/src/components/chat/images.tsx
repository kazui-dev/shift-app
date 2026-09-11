import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import type { ChatAttachment } from "@workspace/shared/communications"
import { chatImageUrl } from "@/api/chat"
import { ResponsiveDialog } from "../responsive-overlay"

export function LocalImage({
  blob,
  alt,
  className,
}: {
  blob: Blob
  alt: string
  className?: string
}) {
  const [url, setUrl] = useState<string>(),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    const value = URL.createObjectURL(blob)
    setUrl(value)
    setFailed(false)
    return () => URL.revokeObjectURL(value)
  }, [blob])
  return failed ? (
    <span
      className={`flex items-center justify-center bg-muted ${className}`}
      title={alt}
    >
      <ImageIcon className="size-5 text-muted-foreground" aria-label={alt} />
    </span>
  ) : url ? (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  ) : null
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
            type="button"
            onClick={() => setOpened(image)}
            aria-label={`画像${index + 1}を拡大`}
            className="w-fit overflow-hidden rounded-xl border text-left"
          >
            <img
              src={chatImageUrl(roomId, image.id)}
              width={image.width}
              height={image.height}
              alt={`添付画像 ${index + 1}`}
              loading="lazy"
              className="max-h-80 w-auto max-w-full object-contain"
            />
          </button>
        ))}
      </div>
      {opened && (
        <ResponsiveDialog
          open
          title="画像"
          className="md:max-w-5xl"
          onOpenChange={(open) => {
            if (!open) setOpened(null)
          }}
        >
          <img
            src={chatImageUrl(roomId, opened.id)}
            width={opened.width}
            height={opened.height}
            alt="添付画像"
            className="max-h-[65dvh] w-full object-contain"
          />
        </ResponsiveDialog>
      )}
    </>
  )
}
