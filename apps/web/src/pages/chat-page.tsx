import { prepareConversation } from "@/components/chat/queries"
import {
  useNavigate,
  useParams,
  useSearch,
  useRouter,
} from "@tanstack/react-router"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { getChatRoom, getChatRooms } from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useOfflineMode } from "@/components/offline-mode-context"
import { RoomList } from "@/components/chat/room-list"
import { MessageCircle } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ChatPanels } from "@/components/chat/panels"
import { ChatConversation } from "@/components/chat/conversation"
import { CreateChat } from "@/components/chat/create-chat"

declare module "@tanstack/react-router" {
  interface HistoryState {
    chatFromList?: boolean
  }
}

export function ChatPage() {
  const client = useQueryClient()
  const desktop = useMediaQuery("(min-width: 768px)")
  const router = useRouter()
  const { report } = useSearch({ strict: false })
  const { roomId } = useParams({ strict: false }),
    navigate = useNavigate(),
    display = useDisplayYear(),
    offline = useOfflineMode()
  const [closed, setClosed] = useState(false),
    [creating, setCreating] = useState(false)
  const [lastRoomId, setLastRoomId] = useState(roomId)
  if (roomId && roomId !== lastRoomId) setLastRoomId(roomId)
  const retainedId = roomId ?? lastRoomId
  useEffect(() => {
    if (roomId && !offline) void prepareConversation(client, roomId)
  }, [client, roomId, offline])
  function back() {
    if (router.history.location.state.chatFromList) router.history.back()
    else void navigate({ to: "/chat", replace: true })
  }
  function resume() {
    if (retainedId)
      void navigate({
        to: "/chat/$roomId",
        params: { roomId: retainedId },
        state: { chatFromList: true },
      })
  }
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
  const first = rooms.data?.rooms[0]?.id
  useEffect(() => {
    if (desktop && !roomId && first)
      void navigate({
        to: "/chat/$roomId",
        params: { roomId: first },
        replace: true,
      })
  }, [desktop, roomId, first, navigate])
  return (
    <>
      <ChatPanels
        showingRoom={!!roomId}
        hasRoom={!!retainedId}
        onBack={back}
        onResume={resume}
        list={
          <RoomList
            rooms={rooms.data?.rooms ?? []}
            closedRooms={archived.data?.rooms ?? []}
            expanded={closed}
            loading={!rooms.data && (display.isPending || rooms.isLoading)}
            loadingClosed={archived.isLoading}
            closedError={archived.isError}
            selectedId={retainedId ?? null}
            fromList={!roomId}
            offline={offline}
            onExpand={() => setClosed((value) => !value)}
            onCreate={() => setCreating(true)}
          />
        }
      >
        {retainedId ? (
          <ChatConversation
            key={retainedId}
            roomId={retainedId}
            name={
              [
                ...(rooms.data?.rooms ?? []),
                ...(archived.data?.rooms ?? []),
              ].find((item) => item.id === retainedId)?.name
            }
            report={report}
            active={!!roomId}
            onBack={back}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <MessageCircle className="size-8" aria-label="ルームを選択" />
          </div>
        )}
      </ChatPanels>
      {creating && year !== null && (
        <CreateChat
          year={year}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            void navigate({
              to: "/chat/$roomId",
              params: { roomId: id },
              state: { chatFromList: !roomId },
            })
          }}
        />
      )}
    </>
  )
}
