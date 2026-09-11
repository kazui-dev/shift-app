import { roomSchedule } from "./room-schedule"
import { BellOff, ChevronRight, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { getChatRooms } from "@/api/chat"
import { DisplayYearNotice } from "@/components/display-year-notice"

type Room = Awaited<ReturnType<typeof getChatRooms>>["rooms"][number]
export function RoomList({
  rooms,
  closedRooms,
  expanded,
  loadingClosed,
  closedError,
  selectedId,
  offline,
  onSelect,
  onExpand,
  onCreate,
}: {
  rooms: Room[]
  closedRooms: Room[]
  expanded: boolean
  loadingClosed: boolean
  closedError: boolean
  selectedId: string | null
  offline: boolean
  onSelect: (id: string) => void
  onExpand: () => void
  onCreate: () => void
}) {
  function items(values: Room[]) {
    return (
      <ul className="space-y-1">
        {values.map((room) => (
          <li key={room.id}>
            <button
              type="button"
              aria-current={selectedId === room.id ? "true" : undefined}
              onClick={() => onSelect(room.id)}
              className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted/50 ${selectedId === room.id ? "bg-muted/70" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm ${selectedId === room.id || room.unreadCount ? "font-semibold" : "font-medium"}`}
                >
                  {room.name}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {roomSchedule(room) ??
                    (room.kind === "global"
                      ? "全メンバーへの連絡"
                      : room.historical
                        ? "退出前の履歴"
                        : "グループ")}
                </span>
              </span>
              {room.muted && (
                <BellOff
                  aria-label="ミュート中"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              )}
              {room.unreadCount > 0 && (
                <span
                  aria-label={`${room.unreadCount}件の未読`}
                  className="min-w-5 rounded-full bg-muted px-1.5 text-center text-xs font-semibold tabular-nums"
                >
                  {room.unreadCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <>
      <div className="flex min-h-12 shrink-0 items-center justify-end gap-2 px-2">
        <DisplayYearNotice />
        {!offline && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="新しいチャット"
            onClick={onCreate}
          >
            <Plus className="size-4" />
            新しいチャット
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {items(rooms)}
        <div className="mt-8">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="closed-chat-rooms"
            onClick={onExpand}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm text-muted-foreground hover:bg-muted/50"
          >
            <span>アーカイブ</span>
            <ChevronRight
              className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
          {expanded && (
            <div id="closed-chat-rooms" className="mt-1">
              {loadingClosed && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  読み込み中…
                </p>
              )}
              {!loadingClosed && !closedError && !closedRooms.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  アーカイブはありません
                </p>
              )}
              {items(closedRooms)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
