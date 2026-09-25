import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { SelectField } from "@/components/select-field"
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
      <label htmlFor="manage-member-search" className="relative w-full md:w-64">
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
      <SelectField
        aria-label="表示するロール"
        value={filters.role}
        className="min-w-36 flex-1 sm:w-auto sm:flex-none"
        options={[
          { value: "", label: "すべてのロール" },
          ...roles.map((role) => ({ value: role.id, label: role.name })),
        ]}
        onValueChange={(role) => onChange({ ...filters, role })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.includeUnavailable}
          onChange={(event) =>
            onChange({
              ...filters,
              includeUnavailable: event.target.checked,
            })
          }
        />
        参加不可・未回答も表示
      </label>
    </div>
  )
}
