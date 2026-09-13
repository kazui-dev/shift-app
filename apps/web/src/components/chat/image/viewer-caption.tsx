import type { ReactNode } from "react"
import { japanDateMinute } from "@workspace/shared/japan-time"
import { MemberAvatar } from "@/components/member-avatar"

/** Who sent the images, when, and their message, with the thumbnails below. */
export function ViewerCaption({
  author,
  image,
  content,
  createdAt,
  children,
}: {
  author: string
  image: string | null
  content: string
  createdAt: string
  children?: ReactNode
}) {
  return (
    <div className="flex max-h-[30dvh] shrink-0 flex-col gap-4 overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] text-sm [scrollbar-width:none]">
      <div className="flex items-start gap-3">
        <MemberAvatar
          name={author}
          image={image}
          className="size-9 bg-white/15 text-white"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold">{author}</span>
            <time className="text-xs text-white/60" dateTime={createdAt}>
              {japanDateMinute(createdAt)}
            </time>
          </div>
          {content && (
            <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">
              {content}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
