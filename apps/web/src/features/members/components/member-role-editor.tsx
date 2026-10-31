import { useQueryClient } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import { changeMemberRoles } from "@/features/years/api/years"
import { MemberLabelEditor } from "./member-label-editor"

export function MemberRoleEditor({
  year,
  memberIds,
  roles,
  onClose,
  onApplied,
  onDirtyChange,
  onPendingChange,
}: {
  year: number
  memberIds: string[]
  roles: { id: string; name: string; memberIds: string[] }[]
  onClose: () => void
  onApplied: () => void
  onPendingChange?: ((pending: boolean) => void) | undefined
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  return (
    <MemberLabelEditor
      label="ロール"
      memberIds={memberIds}
      items={roles}
      onClose={onClose}
      onApplied={onApplied}
      onDirtyChange={onDirtyChange}
      onPendingChange={onPendingChange}
      onApply={async (addRoleIds, removeRoleIds) => {
        await changeMemberRoles(year, { memberIds, addRoleIds, removeRoleIds })
        await Promise.all([
          client.invalidateQueries({ queryKey: keys.roster(year) }),
          client.invalidateQueries({ queryKey: keys.yearRoles(year) }),
          client.invalidateQueries({ queryKey: keys.years() }),
        ])
      }}
    />
  )
}
