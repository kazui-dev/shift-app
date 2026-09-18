import { useQuery } from "@tanstack/react-query"
import { Crown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { membersQuery } from "@/data/chat"
import { MemberAvatar } from "@/components/member-avatar"
import { senderImage } from "@/lib/chat/bot"

export function RoomMembers({
  roomId,
  active,
}: {
  roomId: string
  active: boolean
}) {
  const query = useQuery({
    ...membersQuery(roomId),
    enabled: active,
  })
  return (
    <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-x-contain px-4 py-4">
      <h3 className="mb-4 text-xs font-medium text-muted-foreground">
        メンバー{query.data ? ` · ${query.data.members.length}` : ""}
      </h3>
      {query.isError && (
        <Button variant="ghost" onClick={() => void query.refetch()}>
          再試行
        </Button>
      )}
      <ul className="space-y-4">
        {query.data?.members.map((member) => (
          <li key={member.id} className="flex items-center gap-3">
            <MemberAvatar name={member.displayName} image={member.image} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {member.displayName}
            </span>
            {member.canManage && (
              <Crown
                className="size-4 shrink-0 text-muted-foreground"
                aria-label="管理者"
              />
            )}
          </li>
        ))}
      </ul>
      {!!query.data?.bots.length && (
        <>
          <h3 className="mt-6 mb-4 text-xs font-medium text-muted-foreground">
            bot · {query.data.bots.length}
          </h3>
          <ul className="space-y-4">
            {query.data.bots.map((bot) => (
              <li key={bot.id} className="flex items-center gap-3">
                <MemberAvatar
                  name={bot.displayName}
                  image={senderImage({ bot: true })}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {bot.displayName}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
