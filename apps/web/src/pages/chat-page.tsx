import { MessageTargetProvider } from "@/components/chat/message/target"
import { useCloseOverlay } from "@/components/chat/overlay"
import { keys } from "@/data/keys"
import { RoutePage } from "@/components/route-page"
import { prepareConversation, roomsQuery } from "@/data/chat"
import { warmConversation } from "@/data/chat-warm"
import {
  Outlet,
  getRouteApi,
  useSearch,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { useChatNavigation } from "@/components/chat/use-chat-navigation"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { getChatRoom } from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useOfflineMode } from "@/components/offline-mode-context"
import { RoomList } from "@/components/chat/room/list"
import { useMediaQuery } from "@/hooks/use-media-query"
import { BottomNavigation } from "@/components/app-navigation"
import { ChatWorkspace } from "@/components/chat/workspace"
import { ApiError } from "@/api/client"
import { removeRoom } from "@/data/chat-cache"
import { CreateChat } from "@/components/chat/room/create"
import { restoreChatView, saveChatView } from "@/lib/chat/view"

export function ChatPage() {
  return (
    <MessageTargetProvider>
      <ChatScreen />
    </MessageTargetProvider>
  )
}
function ChatScreen() {
  const client = useQueryClient()
  const { state: account } = getRouteApi("/_app").useRouteContext()
  const memberId = account.member.id
  const router = useRouter()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const explicitList = useRouterState({
    select: (state) => !!state.location.state.chatList,
  })
  const creating = pathname === "/chat/new"
  const desktop = useMediaQuery("(min-width: 768px)")
  const { report } = useSearch({ strict: false })
  const { roomId, retainedId, open, back, resume, remove } = useChatNavigation()
  const display = useDisplayYear(),
    offline = useOfflineMode()
  const closeCreate = useCloseOverlay("create", { to: "/chat" })
  const student = account.member.studentId
  useEffect(() => {
    if (!roomId || offline) return
    void prepareConversation(client, roomId)
    void warmConversation(client, roomId, student)
  }, [client, roomId, offline, student])

  const room = useQuery({
    queryKey: keys.chatRoom(retainedId),
    queryFn: retainedId ? () => getChatRoom(retainedId) : skipToken,
    enabled: !offline && !!roomId,
  })
  const missing = room.error instanceof ApiError && room.error.status === 404
  useEffect(() => {
    if (!missing || offline || !retainedId) return
    remove(retainedId)
    removeRoom(client, retainedId)
  }, [client, missing, offline, retainedId, remove])
  const year = (roomId ? room.data?.room.year : undefined) ?? display.year
  const rooms = useQuery({
    ...roomsQuery(year),
    enabled: !offline,
  })
  // Rooms at the top of the list are the likeliest to open next: prepare their
  // newest screen once per session so they show at once.
  const warmed = useRef(new Set<string>())
  useEffect(() => {
    if (offline) return
    for (const item of rooms.data?.rooms.slice(0, 5) ?? []) {
      if (warmed.current.has(item.id)) continue
      warmed.current.add(item.id)
      void prepareConversation(client, item.id)
      void warmConversation(client, item.id, student)
    }
  }, [client, rooms.data, offline, student])
  const autoRoom =
    desktop && !explicitList && pathname === "/chat" && !roomId && year !== null
      ? restoreChatView(memberId, year, rooms.data?.rooms ?? [])
      : undefined
  const loadedId = room.data?.room.id
  useEffect(() => {
    if (roomId && loadedId === roomId && year !== null && !missing)
      saveChatView(memberId, year, roomId)
  }, [memberId, roomId, loadedId, year, missing])
  useEffect(() => {
    if (autoRoom) open(autoRoom, true)
  }, [autoRoom, open])
  return (
    <>
      <div
        inert={creating && !desktop}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ChatWorkspace
          navigation={<BottomNavigation offline={offline} />}
          showingRoom={!!roomId}
          roomId={retainedId}
          room={missing ? undefined : room.data?.room}
          name={
            (rooms.data?.rooms ?? []).find((item) => item.id === retainedId)
              ?.name ?? ""
          }
          report={report}
          offline={offline}
          error={room.isError && !missing}
          onRetry={() => void room.refetch()}
          onBack={back}
          onResume={resume}
          list={
            <RoomList
              rooms={rooms.data?.rooms ?? []}
              loading={!rooms.data && (display.isPending || rooms.isLoading)}
              selectedId={autoRoom ?? retainedId ?? null}
              fromList={!roomId}
              onOpen={open}
              offline={offline}
              onCreate={() => {
                void router.navigate({
                  to: "/chat/new",
                  state: { chatOverlay: "create" },
                })
              }}
            />
          }
        />
      </div>
      {year !== null && creating && (
        <RoutePage path="/chat/new" onClose={closeCreate}>
          <CreateChat
            key={year}
            year={year}
            onClose={closeCreate}
            onCreated={(id) => {
              open(id, true)
            }}
          />
        </RoutePage>
      )}
      <Outlet />
    </>
  )
}
