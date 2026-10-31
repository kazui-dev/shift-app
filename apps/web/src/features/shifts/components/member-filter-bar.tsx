import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
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
      <label
        htmlFor="manage-member-search"
        className="relative min-w-0 flex-1 basis-full sm:max-w-56 sm:basis-auto"
      >
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          id="manage-member-search"
          className="pl-9"
          aria-label="名前・学籍番号で検索"
          placeholder="名前・学籍番号で検索"
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
        />
      </label>
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
