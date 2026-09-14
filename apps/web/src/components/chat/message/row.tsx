import { CircleAlert } from "lucide-react"
import { japanDateWeekday, japanTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { UploadProgress } from "@/lib/chat/store"
import type { ChatRoom } from "@/api/chat"
import { MemberAvatar } from "@/components/member-avatar"
import {
  MessageImages,
  PendingImages,
} from "@/components/chat/image/attachments"
import { MessageActions } from "@/components/chat/message/actions"
import {
  groupedWithPrevious,
  type MessageRow,
} from "@/components/chat/message/list"
import { MessageLinkPreview } from "@/components/chat/message/link-preview"
import { MessageText } from "@/components/chat/message/text"

export type MessageRowActions = {
  onMenu: () => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenReply: (id: string | null) => void
  onOpenImage: (image: string, sequence: number) => void
  onRetry: () => void
  onCancel: () => void
  onRetryUpload: (fileId: string) => void
}

/**
 * A message that could not be sent, marked on its avatar so nothing below it
 * moves; its menu sends it again or takes it back.
 */
function DeliveryFailed({
  onRetry,
  onCancel,
}: {
  onRetry: () => void
  onCancel: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="destructive"
            size="icon-xs"
            aria-label="送信できませんでした。操作を選ぶ"
            className="absolute -right-1 -bottom-1 size-5 rounded-full border-2 border-background"
          />
        }
      >
        <CircleAlert className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="pointer-events-auto">
        <DropdownMenuItem onClick={onRetry}>再送</DropdownMenuItem>
        <DropdownMenuItem onClick={onCancel}>取り消す</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ChatMessageRow({
  message,
  previous,
  room,
  memberId,
  offline,
  unread,
  editing,
  menuOpen,
  uploads,
  actions,
}: {
  message: MessageRow
  previous: MessageRow | undefined
  room: ChatRoom
  memberId: string
  offline: boolean
  unread: boolean
  editing: boolean
  menuOpen: boolean
  uploads: Record<string, UploadProgress>
  actions: MessageRowActions
}) {
  const { newDay, grouped } = groupedWithPrevious(message, previous, unread)
  return (
    <li
      data-message-id={message.id}
      data-sequence={message.sequence ?? undefined}
      data-delivery={message.status}
      className={grouped ? "py-0.5" : "mt-4 py-0.5 first:mt-0"}
    >
      {newDay && (
        <div className="mb-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{japanDateWeekday(message.createdAt)}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
      {unread && (
        <div className="my-4 flex items-center gap-3 text-xs font-medium">
          <span className="h-px flex-1 bg-border" />
          新着メッセージ
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
      <MessageActions
        message={message}
        room={room}
        memberId={memberId}
        offline={offline}
        editing={editing}
        menuOpen={menuOpen}
        onMenu={actions.onMenu}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        onReply={actions.onReply}
      >
        <div
          data-message-content
          className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3"
        >
          {message.reply && (
            <>
              <div aria-hidden className="relative col-start-1 row-start-1">
                <span className="pointer-events-none absolute top-2 bottom-[-2px] left-4 w-6 rounded-tl-md border-t border-l border-muted-foreground/40" />
              </div>
              <button
                type="button"
                disabled={!!message.reply.deleted}
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.currentTarget.blur()
                  actions.onOpenReply(message.reply?.id ?? null)
                }}
                className="col-start-2 mb-1 flex h-4 min-w-0 items-center gap-1.5 text-left text-xs leading-4 text-muted-foreground enabled:cursor-pointer enabled:hover:text-foreground"
              >
                {message.reply.deleted ? (
                  "削除されたメッセージ"
                ) : (
                  <>
                    <MemberAvatar
                      name={message.reply.memberDisplayName}
                      image={message.reply.memberImage ?? null}
                      className="size-4 text-[8px]"
                    />
                    <span className="max-w-32 shrink-0 truncate">
                      {message.reply.memberDisplayName}
                    </span>
                    <span className="truncate">
                      {message.reply.content || "画像"}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
          <div className="relative self-start">
            {grouped ? (
              <time
                dateTime={message.createdAt}
                className="flex h-lh items-center justify-center text-sm leading-snug whitespace-nowrap text-muted-foreground tabular-nums opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 group-data-active:opacity-100"
              >
                <span className="text-[10px]">
                  {japanTime(message.createdAt)}
                </span>
              </time>
            ) : (
              <MemberAvatar
                name={message.memberDisplayName}
                image={message.memberImage}
                className="mt-0.5"
              />
            )}
            {message.status === "failed" && (
              <DeliveryFailed
                onRetry={actions.onRetry}
                onCancel={actions.onCancel}
              />
            )}
          </div>
          {/* A message ending in media keeps it off the highlight's bottom edge. */}
          <div className="min-w-0 [&>[data-message-media]:last-child]:mb-1">
            {!grouped && (
              <p className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">
                  {message.memberDisplayName}
                </span>
                <time
                  dateTime={message.createdAt}
                  className="text-[11px] text-muted-foreground"
                >
                  {japanTime(message.createdAt)}
                </time>
              </p>
            )}
            {(message.content || message.editedAt) && (
              <p
                data-message-body
                className="max-w-[85ch] text-sm leading-snug break-words whitespace-pre-wrap"
              >
                <MessageText content={message.content} />
                {message.editedAt && (
                  <span className="ml-2 inline-flex h-lh items-center align-top text-muted-foreground">
                    <span className="text-[10px]">(編集済)</span>
                  </span>
                )}
              </p>
            )}
            {message.status === "sent" && message.linkPreview && (
              <MessageLinkPreview
                key={message.linkPreview.url}
                roomId={room.id}
                messageId={message.id}
                preview={message.linkPreview}
              />
            )}
            <MessageImages
              roomId={room.id}
              images={message.attachments}
              onOpen={(image) => {
                if (message.sequence !== null)
                  actions.onOpenImage(image, message.sequence)
              }}
            />
            <PendingImages
              files={message.files}
              uploads={uploads}
              onRetryUpload={actions.onRetryUpload}
            />
          </div>
        </div>
      </MessageActions>
    </li>
  )
}
