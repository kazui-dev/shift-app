import { useQuery } from "@tanstack/react-query"
import { Crown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { membersQuery } from "@/data/chat"
import { MemberAvatar } from "../member-avatar"

export function RoomMembers({
  roomId,
  active,
  historical,
}: {
  roomId: string
  active: boolean
  historical: boolean
}) {
  const query = useQuery({
    ...membersQuery(roomId),
    enabled: active && !historical,
  })
  return (
    <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-x-contain px-4 py-4">
      {!historical && (
        <>
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
        </>
      )}
      {historical && <p className="text-sm text-muted-foreground">退出済み</p>}
    </div>
  )
}
