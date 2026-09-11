import { Outlet, useNavigate, useParams } from "@tanstack/react-router"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { getChatRoom, getChatRooms } from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useOfflineMode } from "@/components/offline-mode-context"
import { RoomList } from "@/components/chat/room-list"
import { CreateChat } from "@/components/chat/create-chat"

export function ChatPage() {
  const { roomId } = useParams({ strict: false }),
    navigate = useNavigate(),
    display = useDisplayYear(),
    offline = useOfflineMode()
  const [closed, setClosed] = useState(false),
    [creating, setCreating] = useState(false)
  const room = useQuery({
    queryKey: ["chat-room", roomId],
    queryFn: roomId ? () => getChatRoom(roomId) : skipToken,
    enabled: !offline,
  })
  const year = room.data?.room.year ?? display.year
  const rooms = useQuery({
    queryKey: ["chat-rooms", year, false],
    queryFn: year === null ? skipToken : () => getChatRooms(year),
    refetchInterval: offline ? false : 30_000,
    enabled: !offline,
  })
  const archived = useQuery({
    queryKey: ["chat-rooms", year, true],
    queryFn: year === null ? skipToken : () => getChatRooms(year, true),
    enabled: !offline && closed,
  })
  return (
    <section className="grid min-h-0 w-full min-w-0 flex-1 md:grid-cols-[17rem_minmax(0,1fr)]">
      <aside
        aria-label="ルーム一覧"
        className={`${roomId ? "hidden" : "flex"} min-h-0 min-w-0 flex-col md:flex md:pr-3`}
      >
        <RoomList
          rooms={rooms.data?.rooms ?? []}
          closedRooms={archived.data?.rooms ?? []}
          expanded={closed}
          loading={!rooms.data && (display.isPending || rooms.isLoading)}
          loadingClosed={archived.isLoading}
          closedError={archived.isError}
          selectedId={roomId ?? null}
          offline={offline}
          onExpand={() => setClosed((value) => !value)}
          onCreate={() => setCreating(true)}
        />
      </aside>
      <div
        className={`${roomId ? "flex" : "hidden"} min-h-0 min-w-0 flex-col md:flex md:border-l`}
      >
        <Outlet />
      </div>
      {creating && year !== null && (
        <CreateChat
          year={year}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            void navigate({ to: "/chat/$roomId", params: { roomId: id } })
          }}
        />
      )}
    </section>
  )
}
