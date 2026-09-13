import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { SelectField } from "@/components/select-field"
import type { EditorData } from "./time-grid"

export type MemberFilters = {
  search: string
  role: string
  includeUnavailable: boolean
}

export function ShiftFiltersDialog({
  filters,
  plan,
  roles,
  onChange,
  onClose,
}: {
  filters: MemberFilters
  plan: ActivityEditorInput
  roles: EditorData["roles"]
  onChange: (filters: MemberFilters) => void
  onClose: () => void
}) {
  return (
    <ResponsiveDialog
      open
      title="メンバーを絞り込む"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-4">
        <label htmlFor="member-search" className="block space-y-2 text-sm">
          名前・学番
          <Input
            id="member-search"
            value={filters.search}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </label>
        <label htmlFor="shift-role" className="block space-y-2 text-sm">
          ロール
          <SelectField
            id="shift-role"
            value={filters.role}
            onValueChange={(role) => onChange({ ...filters, role })}
            options={[
              { value: "", label: "すべて" },
              ...(plan.candidateRoleIds.length > 1
                ? [{ value: "candidates", label: "シフトに設定したロール" }]
                : []),
              ...roles.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.includeUnavailable}
            onChange={(event) =>
              onChange({ ...filters, includeUnavailable: event.target.checked })
            }
          />
          参加不可・未回答のメンバーも表示
        </label>
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() =>
              onChange({ search: "", role: "", includeUnavailable: true })
            }
          >
            解除
          </Button>
          <Button onClick={onClose}>表示する</Button>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
