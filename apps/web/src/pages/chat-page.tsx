import { prepareConversation } from "@/data/chat"
import { useSearch, useRouter, useRouterState } from "@tanstack/react-router"
import { useChatNavigation } from "@/components/chat/use-chat-navigation"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { getChatRoom, getChatRooms } from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useOfflineMode } from "@/components/offline-mode-context"
import { RoomList } from "@/components/chat/room-list"
import { MessageCircle } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { BottomNavigation } from "@/components/app-navigation"
import { ChatPanels } from "@/components/chat/panels"
import { ChatConversation } from "@/components/chat/conversation"
import { CreateChat } from "@/components/chat/create-chat"

export function ChatPage() {
  const client = useQueryClient()
  const router = useRouter()
  const creating = useRouterState({
    select: (state) => state.location.pathname === "/chat/new",
  })
  const desktop = useMediaQuery("(min-width: 768px)")
  const { report } = useSearch({ strict: false })
  const { roomId, retainedId, open, back, resume } = useChatNavigation()
  const display = useDisplayYear(),
    offline = useOfflineMode()
  const [closed, setClosed] = useState(false)
  const closeCreate = () => {
    if (router.history.location.state.chatCreate) router.history.back()
    else void router.navigate({ to: "/chat", replace: true })
  }
  useEffect(() => {
    if (roomId && !offline) void prepareConversation(client, roomId)
  }, [client, roomId, offline])

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
    if (desktop && !creating && !roomId && first) open(first, true)
  }, [desktop, creating, roomId, first, open])
  return (
    <>
      <div
        inert={creating && !desktop}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ChatPanels
          navigation={<BottomNavigation offline={offline} />}
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
              onCreate={() => {
                void router.navigate({
                  to: "/chat/new",
                  state: { chatCreate: true },
                })
              }}
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
              <MessageCircle className="size-8" aria-label="チャットを選択" />
            </div>
          )}
        </ChatPanels>
      </div>
      {year !== null && creating && (
        <CreateChat
          key={year}
          year={year}
          onClose={closeCreate}
          onCreated={(id) => {
            open(id, true)
          }}
        />
      )}
    </>
  )
}
