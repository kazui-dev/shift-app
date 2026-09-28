import type { ActivityEditorInput } from "@workspace/shared/shifts"
import {
  japanInputValue,
  japanLocalDateTime,
} from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { EditorData } from "../editor-data"

export function ShiftSettings({
  value,
  data,
  dirty,
  pending,
  onChange,
  onSubmit,
}: {
  value: ActivityEditorInput
  data: EditorData
  dirty: boolean
  pending: boolean
  onChange: (plan: ActivityEditorInput) => void
  onSubmit: () => void
}) {
  const validRange = Date.parse(value.endsAt) > Date.parse(value.startsAt)
  return (
    <section aria-label="シフトの基本情報" className="mx-auto max-w-4xl">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (validRange && dirty && !pending) onSubmit()
        }}
      >
        <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
          <label htmlFor="shift-name" className="block space-y-2 text-sm">
            名前
            <Input
              id="shift-name"
              required
              value={value.name}
              onChange={(event) =>
                onChange({ ...value, name: event.target.value })
              }
            />
          </label>
          <label htmlFor="shift-place" className="block space-y-2 text-sm">
            場所（任意）
            <Input
              id="shift-place"
              value={value.place}
              onChange={(event) =>
                onChange({ ...value, place: event.target.value })
              }
            />
          </label>
          <label htmlFor="shift-start" className="block space-y-2 text-sm">
            開始
            <Input
              id="shift-start"
              type="datetime-local"
              required
              value={japanInputValue(value.startsAt)}
              onChange={(e) => {
                const at = japanLocalDateTime(e.target.value)
                if (Number.isFinite(at))
                  onChange({ ...value, startsAt: new Date(at).toISOString() })
              }}
            />
          </label>
          <label htmlFor="shift-end" className="block space-y-2 text-sm">
            終了
            <Input
              id="shift-end"
              type="datetime-local"
              required
              value={japanInputValue(value.endsAt)}
              onChange={(e) => {
                const at = japanLocalDateTime(e.target.value)
                if (Number.isFinite(at))
                  onChange({ ...value, endsAt: new Date(at).toISOString() })
              }}
            />
          </label>
          {!validRange && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              終了は開始より後にしてください。
            </p>
          )}
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
              onChange={(e) => onChange({ ...value, color: e.target.value })}
            />
          </label>
          <label htmlFor="shift-notes" className="block space-y-2 text-sm">
            備考
            <Input
              id="shift-notes"
              value={value.notes ?? ""}
              onChange={(e) =>
                onChange({ ...value, notes: e.target.value || null })
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
                    onChange({
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
            シフトを無効にする
            <input
              type="checkbox"
              checked={!value.active}
              onChange={(event) =>
                onChange({ ...value, active: !event.target.checked })
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
                    onChange({
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
          <div className="flex justify-end border-t pt-4 sm:col-span-2">
            <Button type="submit" disabled={pending || !dirty || !validRange}>
              {pending ? "保存中…" : "変更を保存"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
