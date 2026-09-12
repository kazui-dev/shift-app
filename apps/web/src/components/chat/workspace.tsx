import { useEffect, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { MessageCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { type ChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { changeRoomMute } from "@/data/preferences"
import { membersQuery, settingsQuery } from "@/data/chat"
import { attendanceQuery } from "@/data/attendance"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ShiftAttendance } from "../shifts/shift-attendance"
import { ChatPanels } from "./panels"
import { ChatMessages } from "./messages"
import { RoomHeader, MembersHeader } from "./room-header"
import { RoomMembers } from "./room-members"

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
  const [attendanceFor, setAttendanceFor] = useState<string>()
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
    if (room)
      void navigate({
        to: "/chat/$roomId/settings",
        params: { roomId: room.id },
        state: { chatSettings: true },
      })
  }
  const openAttendance = () => {
    if (room?.activityId)
      void client
        .ensureQueryData(attendanceQuery(room.activityId))
        .then(() => setAttendanceFor(room.id))
        .catch((failure) => toast.error(errorMessage(failure)))
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
    </>
  )
}
