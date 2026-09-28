import { useState } from "react"
import { japanMonthDayTime } from "@workspace/shared/japan-time"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import type { EditorData } from "../editor-data"
import { mergePlan } from "./merge-plan"

function describe(value: unknown, data: EditorData): string {
  if (Array.isArray(value))
    return value.map((item) => describe(item, data)).join("、") || "なし"
  if (typeof value === "object" && value !== null) {
    if ("targetId" in value && typeof value.targetId === "string")
      return (
        data.members.find((member) => member.id === value.targetId)
          ?.displayName ??
        data.roles.find((role) => role.id === value.targetId)?.name ??
        "削除された対象"
      )
    if ("startsAt" in value && "endsAt" in value)
      return `${describe(value.startsAt, data)}〜${describe(value.endsAt, data)}`
  }
  if (value === undefined) return "削除"
  if (value === null) return "なし"
  if (typeof value === "boolean") return value ? "有効" : "無効"
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return japanMonthDayTime(value)
    return data.roles.find((role) => role.id === value)?.name ?? value
  }
  return JSON.stringify(value)
}
export function ShiftConflicts({
  base,
  data,
  local,
  latest,
  onClose,
  onMerge,
}: {
  base: ActivityEditorInput
  data: EditorData
  local: ActivityEditorInput
  latest: ActivityEditorInput
  onClose: () => void
  onMerge: (plan: ActivityEditorInput) => void
}) {
  const [choices, setChoices] = useState<Record<string, "local" | "latest">>({})
  const conflicts = mergePlan(base, local, latest).conflicts
  const merged = mergePlan(base, local, latest, choices)
  return (
    <ResponsiveDialog
      open
      title="他の編集内容を確認"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          別々の箇所への変更はまとめて取り込みます。同じ箇所の変更は、残す内容を選んでください。
        </p>
        {conflicts.map((conflict) => (
          <fieldset key={conflict.key} className="space-y-2 border-b pb-3">
            <legend className="mb-2 text-sm font-medium">
              {conflict.label}
            </legend>
            {(["local", "latest"] as const).map((choice) => (
              <label key={choice} className="flex gap-2 text-sm">
                <input
                  type="radio"
                  name={conflict.key}
                  checked={choices[conflict.key] === choice}
                  onChange={() =>
                    setChoices({ ...choices, [conflict.key]: choice })
                  }
                />
                <span className="min-w-0 break-words">
                  <span className="block text-xs text-muted-foreground">
                    {choice === "local" ? "手元の変更" : "保存済みの変更"}
                  </span>
                  {describe(conflict[choice], data)}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        {conflicts.length === 0 && (
          <p className="text-sm">変更した箇所の重複はありません。</p>
        )}
        <Button
          disabled={merged.conflicts.length > 0}
          onClick={() => onMerge(merged.plan)}
        >
          変更を取り込む
        </Button>
      </div>
    </ResponsiveDialog>
  )
}
