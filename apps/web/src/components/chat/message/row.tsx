import { japanDateWeekday, japanTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import type { ChatRoom } from "@/api/chat"
import { MemberAvatar } from "@/components/member-avatar"
import { imageSize } from "@/components/chat/image/size"
import { LocalImage, MessageImages } from "@/components/chat/image/attachments"
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
          ここから未読
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
        <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
          {message.reply && (
            <>
              <div aria-hidden className="relative col-start-1 row-start-1">
                <span className="pointer-events-none absolute top-2 bottom-[-2px] left-4 w-6 rounded-tl-md border-t border-l border-muted-foreground/40" />
              </div>
              <button
                type="button"
                data-message-reply
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
          {grouped ? (
            <time
              dateTime={message.createdAt}
              className="flex h-lh items-center justify-center self-start text-sm leading-snug whitespace-nowrap text-muted-foreground tabular-nums opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 group-data-active:opacity-100"
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
          <div className="min-w-0">
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
            {message.status === "sent" && (
              <MessageLinkPreview
                roomId={room.id}
                messageId={message.id}
                content={message.content}
                offline={offline}
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
            {message.files.length > 0 && (
              <div
                className={`mt-2 grid max-w-lg gap-2 ${message.files.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {message.files.map((file) => (
                  <div
                    key={file.id}
                    className="max-w-full overflow-hidden rounded-xl border"
                    style={imageSize(file.uploaded ?? file.dimensions)}
                  >
                    <LocalImage
                      blob={file.blob}
                      alt={file.name}
                      className="size-full object-contain"
                    />
                  </div>
                ))}
              </div>
            )}
            {message.status === "failed" && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Button size="sm" variant="ghost" onClick={actions.onRetry}>
                  再送
                </Button>
                <Button size="sm" variant="ghost" onClick={actions.onCancel}>
                  取り消す
                </Button>
              </div>
            )}
          </div>
        </div>
      </MessageActions>
    </li>
  )
}
