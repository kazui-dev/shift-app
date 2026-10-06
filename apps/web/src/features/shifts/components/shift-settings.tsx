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
  const requirements = value.requirements
  const ordered = [...requirements].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt)
  )
  const validRequirements = ordered.every(
    (item, index) =>
      Date.parse(item.startsAt) >= Date.parse(value.startsAt) &&
      Date.parse(item.endsAt) <= Date.parse(value.endsAt) &&
      Date.parse(item.startsAt) < Date.parse(item.endsAt) &&
      (index === 0 ||
        Date.parse(ordered[index - 1]?.endsAt ?? "") <=
          Date.parse(item.startsAt))
  )
  function updateRequirement(
    id: string,
    patch: Partial<(typeof requirements)[number]>
  ) {
    onChange({
      ...value,
      requirements: requirements.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    })
  }
  return (
    <section aria-label="シフトの基本情報" className="mx-auto max-w-4xl">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (validRange && validRequirements && dirty && !pending) onSubmit()
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
          <fieldset className="space-y-3 rounded-md border p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">必要人数</legend>
            <p className="text-xs text-muted-foreground">
              勤務する人の時間とは別に設定します。
            </p>
            {ordered.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end"
              >
                <label
                  htmlFor={`requirement-${item.id}-start`}
                  className="space-y-1 text-xs"
                >
                  開始
                  <Input
                    id={`requirement-${item.id}-start`}
                    type="datetime-local"
                    value={japanInputValue(item.startsAt)}
                    onChange={(event) => {
                      const at = japanLocalDateTime(event.target.value)
                      if (Number.isFinite(at))
                        updateRequirement(item.id, {
                          startsAt: new Date(at).toISOString(),
                        })
                    }}
                  />
                </label>
                <label
                  htmlFor={`requirement-${item.id}-end`}
                  className="space-y-1 text-xs"
                >
                  終了
                  <Input
                    id={`requirement-${item.id}-end`}
                    type="datetime-local"
                    value={japanInputValue(item.endsAt)}
                    onChange={(event) => {
                      const at = japanLocalDateTime(event.target.value)
                      if (Number.isFinite(at))
                        updateRequirement(item.id, {
                          endsAt: new Date(at).toISOString(),
                        })
                    }}
                  />
                </label>
                <label
                  htmlFor={`requirement-${item.id}-count`}
                  className="space-y-1 text-xs"
                >
                  人数
                  <Input
                    id={`requirement-${item.id}-count`}
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={item.requiredCount}
                    onChange={(event) => {
                      const count = event.target.valueAsNumber
                      if (Number.isInteger(count) && count >= 0)
                        updateRequirement(item.id, { requiredCount: count })
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...value,
                      requirements: requirements.filter(
                        (r) => r.id !== item.id
                      ),
                    })
                  }
                >
                  削除
                </Button>
              </div>
            ))}
            {!validRequirements && (
              <p role="alert" className="text-sm text-destructive">
                時間帯はシフト内で、重ならないように設定してください。
              </p>
            )}
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={
                ordered.length > 0 &&
                (ordered.at(-1)?.endsAt ?? "") >= value.endsAt
              }
              onClick={() => {
                const startsAt = ordered.at(-1)?.endsAt ?? value.startsAt
                onChange({
                  ...value,
                  requirements: [
                    ...requirements,
                    {
                      id: crypto.randomUUID(),
                      startsAt,
                      endsAt: value.endsAt,
                      requiredCount: 1,
                    },
                  ],
                })
              }}
            >
              時間帯を追加
            </Button>
          </fieldset>
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
            <Button
              size="sm"
              variant="outline"
              type="submit"
              disabled={pending || !dirty || !validRange || !validRequirements}
            >
              {pending ? "保存中…" : "変更を保存"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
