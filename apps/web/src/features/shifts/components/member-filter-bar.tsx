import { ShiftMemberSearch } from "./shift-member-search"
import { FilterMenu } from "@workspace/ui/components/filter-menu"
import type { EditorData } from "../editor-data"
import type { MemberFilters } from "../shift-view-context"

export function MemberFilterBar({
  filters,
  roles,
  onChange,
}: {
  filters: MemberFilters
  roles: EditorData["roles"]
  onChange: (filters: MemberFilters) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShiftMemberSearch
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
      />
      <FilterMenu
        label="ロール"
        options={[
          { value: "unset", label: "未設定" },
          ...roles.map((role) => ({ value: role.id, label: role.name })),
        ]}
        value={filters.roles}
        onChange={(value) => onChange({ ...filters, roles: value })}
      />
      <FilterMenu
        label="希望回答"
        searchable={false}
        options={[
          { value: "available", label: "参加可能" },
          { value: "unavailable", label: "参加不可" },
          { value: "unanswered", label: "未回答" },
        ]}
        value={filters.availability}
        onChange={(value) => onChange({ ...filters, availability: value })}
      />
    </div>
  )
}
