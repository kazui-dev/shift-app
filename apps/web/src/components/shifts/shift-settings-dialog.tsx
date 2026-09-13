import { useState } from "react"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { japanDateTime, japanLocalDateTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import type { EditorData } from "./time-grid"

/** The value a datetime-local input shows for an instant, in Japan time. */
function local(value: string) {
  const date = japanDateTime(value)
  return `${date.date}T${String(date.hour).padStart(2, "0")}:${String(date.minute).padStart(2, "0")}`
}

export function ShiftSettings({
  plan,
  data,
  onSave,
  onClose,
}: {
  plan: ActivityEditorInput
  data: EditorData
  onSave: (plan: ActivityEditorInput) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(plan)
  return (
    <ResponsiveDialog
      open
      title="シフトの設定"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(value)
        }}
      >
        <label htmlFor="shift-name" className="block space-y-2 text-sm">
          名前
          <Input
            id="shift-name"
            required
            value={value.name}
            onChange={(event) =>
              setValue({ ...value, name: event.target.value })
            }
          />
        </label>
        <label htmlFor="shift-place" className="block space-y-2 text-sm">
          場所
          <Input
            id="shift-place"
            required
            value={value.place}
            onChange={(event) =>
              setValue({ ...value, place: event.target.value })
            }
          />
        </label>
        <label htmlFor="shift-start" className="block space-y-2 text-sm">
          開始
          <Input
            id="shift-start"
            type="datetime-local"
            required
            value={local(value.startsAt)}
            onChange={(e) => {
              const at = japanLocalDateTime(e.target.value)
              if (Number.isFinite(at))
                setValue({ ...value, startsAt: new Date(at).toISOString() })
            }}
          />
        </label>
        <label htmlFor="shift-end" className="block space-y-2 text-sm">
          終了
          <Input
            id="shift-end"
            type="datetime-local"
            required
            value={local(value.endsAt)}
            onChange={(e) => {
              const at = japanLocalDateTime(e.target.value)
              if (Number.isFinite(at))
                setValue({ ...value, endsAt: new Date(at).toISOString() })
            }}
          />
        </label>
        <label
          htmlFor="shift-color"
          className="flex items-center justify-between text-sm"
        >
          色
          <Input
            id="shift-color"
            type="color"
            className="w-12 p-1"
            value={value.color}
            onChange={(e) => setValue({ ...value, color: e.target.value })}
          />
        </label>
        <label htmlFor="shift-notes" className="block space-y-2 text-sm">
          備考
          <Input
            id="shift-notes"
            value={value.notes ?? ""}
            onChange={(e) =>
              setValue({ ...value, notes: e.target.value || null })
            }
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm">対象のロール</legend>
          {data.roles.map((role) => (
            <label
              key={role.id}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.candidateRoleIds.includes(role.id)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    candidateRoleIds: e.target.checked
                      ? [...value.candidateRoleIds, role.id]
                      : value.candidateRoleIds.filter((id) => id !== role.id),
                  })
                }
              />
              {role.name}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center justify-between text-sm">
          有効
          <input
            type="checkbox"
            checked={value.active}
            onChange={(event) =>
              setValue({ ...value, active: event.target.checked })
            }
          />
        </label>
        <fieldset className="max-h-60 overflow-auto">
          <legend className="mb-2 text-sm">責任者</legend>
          {[
            ...data.roles.map((role) => ({
              targetType: "role" as const,
              targetId: role.id,
              name: role.name,
            })),
            ...data.members.map((member) => ({
              targetType: "member" as const,
              targetId: member.id,
              name: member.displayName,
            })),
          ].map((target) => (
            <label
              key={`${target.targetType}-${target.targetId}`}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.responsibles.some(
                  (item) =>
                    item.targetType === target.targetType &&
                    item.targetId === target.targetId
                )}
                onChange={(event) =>
                  setValue({
                    ...value,
                    responsibles: event.target.checked
                      ? [
                          ...value.responsibles,
                          {
                            targetType: target.targetType,
                            targetId: target.targetId,
                          },
                        ]
                      : value.responsibles.filter(
                          (item) =>
                            item.targetType !== target.targetType ||
                            item.targetId !== target.targetId
                        ),
                  })
                }
              />
              {target.name}
            </label>
          ))}
        </fieldset>
        <Button type="submit">適用</Button>
      </form>
    </ResponsiveDialog>
  )
}
