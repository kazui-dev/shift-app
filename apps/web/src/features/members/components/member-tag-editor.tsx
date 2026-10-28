import { useQueryClient } from "@tanstack/react-query"
import type { YearTag } from "@workspace/shared/shifts"
import { keys } from "@/app/data/keys"
import { changeMemberTags } from "../api/tags"
import { MemberLabelEditor } from "./member-label-editor"

export function MemberTagEditor({
  year,
  memberIds,
  tags,
  onClose,
  onApplied,
  onDirtyChange,
}: {
  year: number
  memberIds: string[]
  tags: YearTag[]
  onClose: () => void
  onApplied: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  return (
    <MemberLabelEditor
      label="タグ"
      memberIds={memberIds}
      items={tags}
      onClose={onClose}
      onApplied={onApplied}
      onDirtyChange={onDirtyChange}
      onApply={async (addTagIds, removeTagIds) => {
        await changeMemberTags(year, { memberIds, addTagIds, removeTagIds })
        await client.invalidateQueries({ queryKey: keys.yearTags(year) })
      }}
    />
  )
}
