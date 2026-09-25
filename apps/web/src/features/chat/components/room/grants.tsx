import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePage,
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import type { ChatTargetOption } from "@workspace/shared/communications"
import type { getRoomSettings } from "@/features/chat/api/chat"
import { SelectField } from "@/components/select-field"
import { TargetAvatar } from "@/features/chat/components/room/target-avatar"
import { TargetPicker } from "@/features/chat/components/room/target-picker"
import { targetKey } from "@/features/chat/components/room/target-key"

type Grants = Awaited<ReturnType<typeof getRoomSettings>>["targets"]
export function RoomGrants({
  value,
  targets,
  onChange,
}: {
  value: Grants
  targets: ChatTargetOption[]
  onChange: (value: Grants) => void
}) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  function apply() {
    onChange([
      ...value.filter(
        (grant) =>
          selected.includes(targetKey(grant)) &&
          !targets.some((target) => targetKey(target) === targetKey(grant))
      ),
      ...targets
        .filter((target) => selected.includes(targetKey(target)))
        .map(
          (target) =>
            value.find((grant) => targetKey(grant) === targetKey(target)) ?? {
              targetType: target.targetType,
              targetId: target.targetId,
              canRead: true,
              canPost: true,
              canManage: false,
            }
        ),
    ])
    setSelecting(false)
  }
  return (
    <section className="space-y-3" aria-label="参加対象">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          参加対象{" "}
          <span className="ml-1 text-muted-foreground">{value.length}</span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelected(value.map(targetKey))
            setSelecting(true)
          }}
        >
          <Plus />
          追加・変更
        </Button>
      </div>
      <ul className="divide-y border-y">
        {value.map((grant) => {
          const key = targetKey(grant),
            target = targets.find((candidate) => targetKey(candidate) === key)
          const name = target?.displayName ?? "対象を確認できません"
          const permission = grant.canManage
            ? "manage"
            : grant.canPost
              ? "post"
              : grant.canRead
                ? "read"
                : "none"
          return (
            <li
              key={key}
              className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-3 py-4"
            >
              {target ? <TargetAvatar target={target} /> : <span />}
              <span className="truncate text-sm font-medium" title={name}>
                {name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${name}の設定を削除`}
                onClick={() =>
                  onChange(value.filter((item) => targetKey(item) !== key))
                }
              >
                <X />
              </Button>
              <SelectField
                aria-label={`${name}の権限`}
                className="col-span-2 col-start-2"
                value={permission}
                onValueChange={(level) => {
                  onChange(
                    value.map((item) =>
                      targetKey(item) === key
                        ? {
                            ...item,
                            canRead: level !== "none",
                            canPost: level === "post" || level === "manage",
                            canManage: level === "manage",
                          }
                        : item
                    )
                  )
                }}
                options={[
                  { value: "read", label: "閲覧のみ" },
                  { value: "post", label: "閲覧・投稿" },
                  { value: "manage", label: "管理権限" },
                  { value: "none", label: "権限なし" },
                ]}
              />
            </li>
          )
        })}
        {value.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            対象がありません
          </li>
        )}
      </ul>
      <ResponsivePage open={selecting} onClose={() => setSelecting(false)}>
        <ResponsivePageHeader
          title="参加対象"
          onBack={() => setSelecting(false)}
          action={
            <Button type="button" size="sm" onClick={apply}>
              適用
            </Button>
          }
        />
        <ResponsivePageBody>
          <TargetPicker
            targets={targets}
            selected={selected}
            onChange={setSelected}
          />
        </ResponsivePageBody>
      </ResponsivePage>
    </section>
  )
}
