import { PageHeader } from "@workspace/ui/components/page-header"
import { useQueryClient } from "@tanstack/react-query"
import { prepareConversation } from "@/features/chat/data/chat"
import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { BellOff, Plus, Search, MessageCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { getChatRooms } from "@/features/chat/api/chat"
import { roomSchedule } from "@/features/chat/components/room/schedule"

type Room = Awaited<ReturnType<typeof getChatRooms>>["rooms"][number]
export function RoomList({
  rooms,
  loading,
  selectedId,
  fromList,
  offline,
  onCreate,
  onOpen,
}: {
  rooms: Room[]
  loading: boolean
  selectedId: string | null
  fromList: boolean
  offline: boolean
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const client = useQueryClient()
  const prepare = (id: string) => {
    if (!offline) void prepareConversation(client, id)
  }
  const [search, setSearch] = useState("")
  const items = (
    <ul className="space-y-0.5">
      {rooms
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
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") prepare(room.id)
                }}
                onFocus={() => prepare(room.id)}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return
                  event.preventDefault()
                  prepare(room.id)
                  onOpen(room.id)
                }}
                aria-current={selectedId === room.id ? "page" : undefined}
                className={`flex min-h-14 items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 active:bg-muted ${selectedId === room.id ? "bg-muted/70" : ""}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                  <MessageCircle className="size-5" aria-hidden />
                </span>
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
                    {room.unreadCount > 99 ? "99+" : room.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
    </ul>
  )
  return (
    <>
      <PageHeader className="gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="チャットを検索"
            placeholder="チャットを検索"
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
      </PageHeader>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto p-4">
        {loading ? (
          <output className="block px-3 py-4 text-sm text-muted-foreground">
            読み込み中…
          </output>
        ) : (
          items
        )}
      </div>
    </>
  )
}
