import type { ReactNode } from "react"
import { ArrowLeft, BellOff, Settings, Search } from "lucide-react"
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
  onSettings,
}: {
  room: ChatRoom
  offline: boolean
  onSettings: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Muting is a switch in the room's settings; here it only shows. */}
      {room.muted && (
        <span
          title="通知オフ"
          className="flex size-8 items-center justify-center text-muted-foreground"
        >
          <BellOff className="size-4" />
          <span className="sr-only">通知オフ</span>
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={offline}
        aria-label="チャット設定"
        onClick={onSettings}
      >
        <Settings />
      </Button>
    </div>
  )
}

export function RoomHeader({
  room,
  name,
  offline,
  onBack,
  onMembers,
  onSettings,
  onAttendance,
  onSearch,
}: {
  room: ChatRoom | undefined
  name: string
  offline: boolean
  onBack: () => void
  onMembers: () => void
  onSettings: () => void
  onAttendance: () => void
  onSearch: () => void
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
      {/* The heading holds the button, as a button cannot hold a heading. */}
      <h1 className="min-w-0 flex-1 text-sm font-semibold">
        <button
          type="button"
          disabled={!room}
          onClick={onMembers}
          aria-label={`${name}のチャット情報`}
          className="block w-full truncate text-left md:hidden"
        >
          {name}
        </button>
        <span className="hidden truncate md:block">{name}</span>
      </h1>
      {room?.activityId && (
        <Button variant="ghost" size="sm" onClick={onAttendance}>
          出勤・連絡
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="チャットを検索"
        disabled={!room || offline}
        onClick={onSearch}
      >
        <Search />
      </Button>
      {room && (
        <div className="hidden md:block">
          <RoomControls room={room} offline={offline} onSettings={onSettings} />
        </div>
      )}
    </HeaderRow>
  )
}

export function MembersHeader({
  room,
  offline,
  onBack,
  onSettings,
}: {
  room: ChatRoom
  offline: boolean
  onBack: () => void
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
        <RoomControls room={room} offline={offline} onSettings={onSettings} />
      </div>
    </HeaderRow>
  )
}
