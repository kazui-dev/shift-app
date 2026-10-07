import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { SelectField } from "@/components/select-field"
import type { EditorData } from "../editor-data"
import type { MemberFilters } from "../shift-view-context"

export function MemberFilterBar({
  filters,
  roles,
  onChange,
  showAvailability,
  onShowAvailability,
}: {
  showAvailability: boolean
  onShowAvailability: (show: boolean) => void
  filters: MemberFilters
  roles: EditorData["roles"]
  onChange: (filters: MemberFilters) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="manage-member-search"
        className="relative min-w-0 flex-1 sm:max-w-56"
      >
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          id="manage-member-search"
          className="h-9 pl-9"
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
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showAvailability}
          onChange={(e) => onShowAvailability(e.target.checked)}
        />
        希望
      </label>
    </div>
  )
}
