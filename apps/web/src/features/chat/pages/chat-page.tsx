import { MessageTargetProvider } from "@/features/chat/components/message/target"
import { useCloseOverlay } from "@/features/chat/components/overlay"
import { RoutePage } from "@/app/route-page"
import { roomQuery, roomsQuery } from "@/features/chat/data/chat"
import { warmConversation } from "@/features/chat/data/chat-warm"
import {
  Outlet,
  getRouteApi,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { useChatNavigation } from "@/features/chat/components/use-chat-navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useDisplayYear } from "@/app/use-display-year"
import { useOfflineMode } from "@/app/offline-mode-context"
import { RoomList } from "@/features/chat/components/room/list"
import { useMediaQuery } from "@/lib/hooks/use-media-query"
import { BottomNavigation } from "@/app/app-navigation"
import { ChatWorkspace } from "@/features/chat/components/workspace"
import { ApiError } from "@/lib/http/client"
import { removeRoom } from "@/features/chat/data/chat-cache"
import { CreateChat } from "@/features/chat/components/room/create"
import { restoreChatView, saveChatView } from "@/features/chat/lib/view"

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
  const { roomId, retainedId, open, back, resume, remove } = useChatNavigation()
  const display = useDisplayYear(),
    offline = useOfflineMode()
  const closeCreate = useCloseOverlay("create", { to: "/chat" })
  const student = account.member.studentId
  useEffect(() => {
    if (!roomId || offline) return
    void warmConversation(client, roomId, student)
  }, [client, roomId, offline, student])

  const room = useQuery({
    ...roomQuery(retainedId),
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
