import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { BellOff, ChevronRight, Plus, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { getChatRooms } from "@/api/chat"
import { roomSchedule } from "./room-schedule"

type Room = Awaited<ReturnType<typeof getChatRooms>>["rooms"][number]
export function RoomList({
  rooms,
  closedRooms,
  expanded,
  loading,
  loadingClosed,
  closedError,
  selectedId,
  fromList,
  offline,
  onExpand,
  onCreate,
}: {
  rooms: Room[]
  closedRooms: Room[]
  expanded: boolean
  loading: boolean
  loadingClosed: boolean
  closedError: boolean
  selectedId: string | null
  fromList: boolean
  offline: boolean
  onExpand: () => void
  onCreate: () => void
}) {
  const [search, setSearch] = useState("")
  function items(values: Room[]) {
    return (
      <ul className="space-y-0.5">
        {values
          .filter((room) =>
            room.name
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase())
          )
          .map((room) => {
            const schedule = roomSchedule(room)
            return (
              <li key={room.id}>
                <Link
                  to="/chat/$roomId"
                  state={{ chatFromList: fromList }}
                  params={{ roomId: room.id }}
                  aria-current={selectedId === room.id ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-muted/50 ${selectedId === room.id ? "bg-muted/70" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${room.unreadCount || selectedId === room.id ? "font-semibold" : "font-medium"}`}
                    >
                      {room.name}
                    </span>
                    {schedule && (
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {schedule}
                      </span>
                    )}
                    {room.historical && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        退出前の履歴
                      </span>
                    )}
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
                      className="min-w-5 rounded-full bg-foreground px-1.5 text-center text-[11px] font-medium text-background tabular-nums"
                    >
                      {room.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
      </ul>
    )
  }
  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 px-1 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="ルームを検索"
            placeholder="ルームを検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 border-transparent bg-muted/40 pl-8 text-sm shadow-none"
          />
        </div>
        {!offline && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="新しいチャット"
            title="新しいチャット"
            onClick={onCreate}
          >
            <Plus />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-y-auto px-1 pb-3">
        {loading ? (
          <output className="block px-3 py-4 text-sm text-muted-foreground">
            読み込み中…
          </output>
        ) : (
          <>
            {items(rooms)}
            <div className="mt-8">
              <button
                type="button"
                onClick={onExpand}
                aria-expanded={expanded}
                aria-controls="archived-chat-rooms"
                className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm text-muted-foreground hover:bg-muted/50"
              >
                アーカイブ
                <ChevronRight
                  className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
              {expanded && (
                <div id="archived-chat-rooms" className="mt-1">
                  {loadingClosed && (
                    <output className="block px-3 py-2 text-xs text-muted-foreground">
                      読み込み中…
                    </output>
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
          </>
        )}
      </div>
    </>
  )
}
