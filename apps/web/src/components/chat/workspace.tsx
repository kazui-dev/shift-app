import { useEffect, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { MessageCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { deleteChatRoom, leaveChatRoom, type ChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { changeRoomMute } from "@/data/preferences"
import { removeRoom } from "@/data/chat-cache"
import { membersQuery, settingsQuery } from "@/data/chat"
import { attendanceQuery } from "@/data/attendance"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ConfirmDialog } from "../confirm-dialog"
import { ShiftAttendance } from "../shifts/shift-attendance"
import { useChatStore } from "./use-chat-store"
import { ChatPanels } from "./panels"
import { ChatMessages } from "./messages"
import { RoomHeader, MembersHeader } from "./room-header"
import { RoomMembers } from "./room-members"
import { RoomSettings } from "./room-settings"

export function ChatWorkspace({
  room,
  roomId,
  name,
  showingRoom,
  offline,
  report,
  list,
  navigation,
  error,
  onRetry,
  onBack,
  onResume,
}: {
  room: ChatRoom | undefined
  roomId: string | undefined
  name: string
  showingRoom: boolean
  offline: boolean
  report: string | undefined
  list: ReactNode
  navigation: ReactNode
  error: boolean
  onRetry: () => void
  onBack: () => void
  onResume: () => void
}) {
  const client = useQueryClient(),
    navigate = useNavigate()
  const desktop = useMediaQuery("(min-width: 768px)")
  const [membersFor, setMembersFor] = useState<string>()
  const [settingsFor, setSettingsFor] = useState<string>()
  const [attendanceFor, setAttendanceFor] = useState<string>()
  const [action, setAction] = useState<{
    roomId: string
    kind: "leave" | "delete"
  }>()
  const { store, queue } = useChatStore()
  const membersOpen = !!roomId && membersFor === roomId
  useEffect(() => {
    setMembersFor(undefined)
  }, [roomId, showingRoom])
  useEffect(() => {
    if (!room || !showingRoom || offline || room.historical) return
    void client.prefetchQuery(membersQuery(room.id))
    if (room.canManage) void client.prefetchQuery(settingsQuery(room.id))
  }, [client, room, showingRoom, offline])
  useEffect(() => {
    if (!report || !room?.activityId) return undefined
    let active = true
    void client
      .ensureQueryData(attendanceQuery(room.activityId))
      .then(() => {
        if (active) setAttendanceFor(room.id)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [client, report, room?.activityId, room?.id])
  const mute = () => {
    if (room)
      void changeRoomMute(client, room.id, !room.muted).catch((failure) =>
        toast.error(errorMessage(failure))
      )
  }
  const openSettings = () => {
    if (room) setSettingsFor(room.id)
  }
  const openAttendance = () => {
    if (room?.activityId)
      void client
        .ensureQueryData(attendanceQuery(room.activityId))
        .then(() => setAttendanceFor(room.id))
        .catch((failure) => toast.error(errorMessage(failure)))
  }
  async function confirm() {
    if (!room || action?.roomId !== room.id) return
    const command = action.kind
    setAction(undefined)
    try {
      if (command === "leave") {
        await leaveChatRoom(room.id)
        setSettingsFor(undefined)
        await Promise.all([
          client.invalidateQueries({ queryKey: ["chat-rooms"] }),
          client.invalidateQueries({ queryKey: ["chat-room", room.id] }),
          client.invalidateQueries({ queryKey: ["chat-members", room.id] }),
        ])
      } else {
        await deleteChatRoom(room.id)
        for (const queued of queue.filter((item) => item.roomId === room.id))
          store.cancel(queued.id)
        store.edit(room.id, { content: "", files: [] })
        removeRoom(client, room.id)
        setSettingsFor(undefined)
        await navigate({ to: "/chat", replace: true })
      }
    } catch (failure) {
      toast.error(errorMessage(failure))
    }
  }
  return (
    <>
      <ChatPanels
        showingRoom={showingRoom}
        hasRoom={!!roomId}
        showingMembers={membersOpen}
        onMembers={() => setMembersFor(roomId)}
        onConversation={() => setMembersFor(undefined)}
        onBack={onBack}
        onResume={onResume}
        list={list}
        navigation={navigation}
        header={
          <RoomHeader
            room={room}
            name={room?.name ?? name}
            offline={offline}
            onBack={onBack}
            onMembers={() => setMembersFor(roomId)}
            onMute={mute}
            onSettings={openSettings}
            onAttendance={openAttendance}
          />
        }
        members={
          room && (
            <>
              <MembersHeader
                room={room}
                offline={offline}
                onBack={() => setMembersFor(undefined)}
                onMute={mute}
                onSettings={openSettings}
              />
              <RoomMembers
                roomId={room.id}
                active={!offline && (desktop || membersOpen)}
                historical={room.historical}
              />
            </>
          )
        }
      >
        {room ? (
          <ChatMessages
            key={room.id}
            room={room}
            active={showingRoom}
            offline={offline}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
            {error ? (
              <Button variant="ghost" onClick={onRetry}>
                再試行
              </Button>
            ) : (
              <MessageCircle
                className="size-8"
                aria-label={roomId ? "会話を取得しています" : "チャットを選択"}
              />
            )}
          </div>
        )}
      </ChatPanels>
      {room && (
        <RoomSettings
          key={room.id}
          room={room}
          open={showingRoom && settingsFor === room.id}
          onClose={() => setSettingsFor(undefined)}
          onLeave={() => setAction({ roomId: room.id, kind: "leave" })}
          onDelete={() => setAction({ roomId: room.id, kind: "delete" })}
        />
      )}
      {room?.activityId && showingRoom && attendanceFor === room.id && (
        <ShiftAttendance
          activityId={room.activityId}
          onClose={() => {
            setAttendanceFor(undefined)
            void navigate({
              to: "/chat/$roomId",
              params: { roomId: room.id },
              search: {},
              replace: true,
            })
          }}
        />
      )}
      {showingRoom && action && action.roomId === room?.id && (
        <ConfirmDialog
          title={
            action.kind === "leave"
              ? "チャットから退出しますか"
              : "チャットを削除しますか"
          }
          description={
            action.kind === "leave"
              ? "退出するまでの履歴は引き続き確認できます。"
              : "全員の一覧から消え、メッセージと画像も削除されます。この操作は取り消せません。"
          }
          confirmLabel={action.kind === "leave" ? "退出" : "削除"}
          onCancel={() => setAction(undefined)}
          onConfirm={() => void confirm()}
        />
      )}
    </>
  )
}
