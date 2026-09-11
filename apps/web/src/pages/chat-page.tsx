import { prepareConversation } from "@/data/chat"
import { useNavigate, useSearch, useRouter } from "@tanstack/react-router"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useEffect,
  useState,
  useLayoutEffect,
  useSyncExternalStore,
  useCallback,
} from "react"
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
  const subscribe = useCallback(
    (changed: () => void) => router.history.subscribe(changed),
    [router]
  )
  // History changes before async loaders settle; the panels must accept input immediately.
  const pathname = useSyncExternalStore(
    subscribe,
    () => router.history.location.pathname
  )
  const roomId = /^\/chat\/([^/]+)$/.exec(pathname)?.[1]
  const navigate = useNavigate(),
    display = useDisplayYear(),
    offline = useOfflineMode()
  const [closed, setClosed] = useState(false),
    [creating, setCreating] = useState(false)
  const [lastRoomId, setLastRoomId] = useState(roomId)
  useLayoutEffect(() => {
    if (roomId) setLastRoomId(roomId)
  }, [roomId])
  const retainedId = roomId ?? lastRoomId
  useEffect(() => {
    if (roomId && !offline) void prepareConversation(client, roomId)
  }, [client, roomId, offline])
  function open(id: string) {
    setLastRoomId(id)
    void navigate({
      to: "/chat/$roomId",
      params: { roomId: id },
      state: { chatFromList: true },
    })
  }
  function back() {
    if (router.history.location.state.chatFromList) router.history.back()
    else void navigate({ to: "/chat", replace: true })
  }
  function resume() {
    if (retainedId) open(retainedId)
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
    staleTime: 60_000,
    refetchInterval: offline ? false : 30_000,
    enabled: !offline,
  })
  const archived = useQuery({
    queryKey: ["chat-rooms", year, true],
    queryFn: year === null ? skipToken : () => getChatRooms(year, true),
    enabled: !offline && closed,
    staleTime: 60_000,
  })
  const first = rooms.data?.rooms[0]?.id
  useEffect(() => {
    if (desktop && pathname === "/chat" && !roomId && first)
      void navigate({
        to: "/chat/$roomId",
        params: { roomId: first },
        replace: true,
      })
  }, [desktop, pathname, roomId, first, navigate])
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
            onOpen={open}
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
