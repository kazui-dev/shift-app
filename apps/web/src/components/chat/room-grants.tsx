import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import type { ChatTargetOption } from "@workspace/shared/communications"
import type { getRoomSettings } from "@/api/chat"
import { TargetAvatar } from "./target-avatar"
import { targetKey } from "./target-key"

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
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState("")
  const candidates = targets.filter(
    (target) =>
      !value.some((grant) => targetKey(grant) === targetKey(target)) &&
      target.displayName
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
  )
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">参加対象</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={adding}
          onClick={() => setAdding((open) => !open)}
        >
          <Plus />
          追加
        </Button>
      </div>
      {adding && (
        <div className="space-y-2 rounded-xl border p-3">
          <Input
            aria-label="追加する対象を検索"
            placeholder="名前・ロール・シフトを検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className="max-h-56 overflow-y-auto">
            {candidates.map((target) => (
              <li key={targetKey(target)}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onChange([
                      ...value,
                      {
                        targetType: target.targetType,
                        targetId: target.targetId,
                        canRead: true,
                        canPost: true,
                        canManage: false,
                      },
                    ])
                    setSearch("")
                    setAdding(false)
                  }}
                >
                  <TargetAvatar target={target} />
                  <span className="min-w-0 flex-1 truncate">
                    {target.displayName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="divide-y">
        {value.map((grant, index) => {
          const target = targets.find(
            (candidate) => targetKey(candidate) === targetKey(grant)
          )
          const name = target?.displayName ?? "対象を確認できません"
          return (
            <li key={targetKey(grant)} className="space-y-3 py-4 first:pt-0">
              <div className="flex items-center gap-3">
                {target && <TargetAvatar target={target} />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${name}の設定を削除`}
                  onClick={() =>
                    onChange(value.filter((_, position) => position !== index))
                  }
                >
                  <X />
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                {(
                  [
                    {
                      key: "canRead",
                      label: "閲覧",
                      implied: grant.canPost || grant.canManage,
                    },
                    { key: "canPost", label: "投稿", implied: grant.canManage },
                    { key: "canManage", label: "管理", implied: false },
                  ] as const
                ).map(({ key, label, implied }) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={grant[key] || implied}
                      disabled={implied}
                      onCheckedChange={(checked) =>
                        onChange(
                          value.map((item, position) =>
                            position === index
                              ? { ...item, [key]: checked }
                              : item
                          )
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
