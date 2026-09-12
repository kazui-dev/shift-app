import { membersQuery } from "@/data/chat"
import { useQuery } from "@tanstack/react-query"
import { type getChatRoom } from "@/api/chat"
import { ResponsiveSheet } from "../responsive-overlay"
import { MemberAvatar } from "../member-avatar"
import { roomSchedule } from "./room-schedule"
export function RoomInfo({
  room,
  onClose,
}: {
  room: Awaited<ReturnType<typeof getChatRoom>>["room"]
  onClose: () => void
}) {
  const query = useQuery({
    ...membersQuery(room.id),
    enabled: !room.historical,
  })
  return (
    <ResponsiveSheet
      open
      title={room.name}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-5">
        {roomSchedule(room) && (
          <p className="text-sm text-muted-foreground">{roomSchedule(room)}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {room.historical
            ? "退出前の履歴を表示しています。"
            : "参加しているメンバーに届きます。"}
        </p>
        {!room.historical && (
          <div>
            <h3 className="mb-3 text-sm font-medium">
              メンバー{query.data ? ` · ${query.data.members.length}` : ""}
            </h3>
            <ul className="space-y-4">
              {query.data?.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3">
                  <MemberAvatar
                    name={member.displayName}
                    image={member.image}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {member.displayName}
                  </span>
                  {member.canManage && (
                    <span className="text-xs text-muted-foreground">
                      設定変更可
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  )
}
