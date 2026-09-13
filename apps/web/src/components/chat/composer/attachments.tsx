import { X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { ChatFile } from "@/lib/chat/store"
import { LocalImage } from "@/components/chat/image/attachments"

export function ComposerAttachments({
  files,
  onRemove,
}: {
  files: ChatFile[]
  onRemove: (id: string) => void
}) {
  if (!files.length) return null
  return (
    <div data-composer-rail className="relative isolate">
      <ul
        data-horizontal-scroll
        className="flex max-w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none]"
        aria-label="添付する画像"
      >
        {files.map((file) => (
          <li
            key={file.id}
            className="relative size-20 shrink-0 overflow-hidden rounded-xl"
          >
            <LocalImage
              blob={file.blob}
              alt={file.name}
              className="size-full object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="absolute top-1 right-1 rounded-full"
              aria-label={`${file.name}を外す`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => onRemove(file.id)}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
