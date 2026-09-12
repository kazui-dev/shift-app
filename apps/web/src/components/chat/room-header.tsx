import type { ReactNode } from "react"
import { ArrowLeft, Bell, BellOff, Settings } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { ChatRoom } from "@/api/chat"

function HeaderRow({
  children,
  mobile = false,
}: {
  children: ReactNode
  mobile?: boolean
}) {
  return (
    <header
      className={`flex h-15 shrink-0 items-center gap-2 border-b px-4 pt-3 ${mobile ? "md:hidden" : ""}`}
    >
      {children}
    </header>
  )
}

function RoomControls({
  room,
  offline,
  onMute,
  onSettings,
}: {
  room: ChatRoom
  offline: boolean
  onMute: () => void
  onSettings: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={offline}
        aria-label={room.muted ? "通知をオンにする" : "ミュートする"}
        onClick={onMute}
      >
        {room.muted ? <BellOff /> : <Bell />}
      </Button>
      {(room.canManage || (room.allowExit && !room.historical)) && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={offline}
          aria-label="チャット設定"
          onClick={onSettings}
        >
          <Settings />
        </Button>
      )}
    </div>
  )
}

export function RoomHeader({
  room,
  name,
  offline,
  onBack,
  onMembers,
  onMute,
  onSettings,
  onAttendance,
}: {
  room: ChatRoom | undefined
  name: string
  offline: boolean
  onBack: () => void
  onMembers: () => void
  onMute: () => void
  onSettings: () => void
  onAttendance: () => void
}) {
  return (
    <HeaderRow>
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="チャット一覧へ"
        onClick={onBack}
      >
        <ArrowLeft />
      </Button>
      <button
        type="button"
        disabled={!room}
        onClick={onMembers}
        aria-label={`${name}のメンバー`}
        className="min-w-0 flex-1 text-left md:hidden"
      >
        <h1 className="truncate text-sm font-semibold">{name}</h1>
      </button>
      <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        <h1 className="truncate text-sm font-semibold">{name}</h1>
      </div>
      {room?.activityId && (
        <Button variant="ghost" size="sm" onClick={onAttendance}>
          出勤・連絡
        </Button>
      )}
      {room && (
        <div className="hidden md:block">
          <RoomControls
            room={room}
            offline={offline}
            onMute={onMute}
            onSettings={onSettings}
          />
        </div>
      )}
    </HeaderRow>
  )
}

export function MembersHeader({
  room,
  offline,
  onBack,
  onMute,
  onSettings,
}: {
  room: ChatRoom
  offline: boolean
  onBack: () => void
  onMute: () => void
  onSettings: () => void
}) {
  return (
    <HeaderRow mobile>
      <div className="w-17 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="会話へ戻る"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
      </div>
      <h2
        title={room.name}
        className="min-w-0 flex-1 truncate text-center text-sm font-semibold"
      >
        {room.name}
      </h2>
      <div className="flex w-17 shrink-0 justify-end">
        <RoomControls
          room={room}
          offline={offline}
          onMute={onMute}
          onSettings={onSettings}
        />
      </div>
    </HeaderRow>
  )
}
