import { Plus, X } from "lucide-react"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { getRoomSettings, getChatTargets, saveRoomSettings } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "./responsive-overlay"
export function ChatSettings({
  id,
  year,
  onClose,
}: {
  id: string
  year: number
  onClose: () => void
}) {
  const settings = useQuery({
    queryKey: ["chat-settings", id],
    queryFn: () => getRoomSettings(id),
  })
  const targets = useQuery({
    queryKey: ["chat-targets", year],
    queryFn: () => getChatTargets(year),
  })
  return (
    <ResponsiveDialog
      open
      title="ルーム設定"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {settings.data && targets.data && (
        <SettingsForm
          id={id}
          initial={settings.data}
          targets={targets.data.targets}
          onClose={onClose}
        />
      )}
    </ResponsiveDialog>
  )
}
function SettingsForm({
  id,
  initial,
  targets,
  onClose,
}: {
  id: string
  initial: Awaited<ReturnType<typeof getRoomSettings>>
  targets: Awaited<ReturnType<typeof getChatTargets>>["targets"]
  onClose: () => void
}) {
  const client = useQueryClient(),
    [value, setValue] = useState(initial),
    [pending, setPending] = useState(false),
    [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  async function save() {
    setPending(true)
    try {
      await saveRoomSettings(id, value)
      await client.invalidateQueries({ queryKey: ["chat-rooms"] })
      await client.invalidateQueries({ queryKey: ["chat-settings", id] })
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      {initial.kind === "custom" ? (
        <label htmlFor="chat-room-name" className="block space-y-2 text-sm">
          ルーム名
          <Input
            id="chat-room-name"
            value={value.name}
            onChange={(event) =>
              setValue({ ...value, name: event.target.value })
            }
          />
        </label>
      ) : (
        <p className="text-sm font-medium">{value.name}</p>
      )}
      {initial.kind !== "custom" && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {initial.kind === "global"
            ? "年度のメンバーは全員閲覧できます。"
            : "参加者・責任者のアクセスはシフトに連動します。"}
          ここでは追加のアクセス権限を設定します。
        </p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {initial.kind === "custom" ? "アクセス権限" : "追加のアクセス権限"}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdding((open) => !open)}
            aria-expanded={adding}
          >
            <Plus className="size-3.5" />
            追加
          </Button>
        </div>
        {adding && (
          <div className="space-y-2 rounded-lg border p-3">
            <Input
              aria-label="追加する対象を検索"
              placeholder="名前・ロール・シフトを検索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ul className="max-h-44 overflow-y-auto">
              {targets
                .filter(
                  (target) =>
                    target.displayName.includes(search) &&
                    !value.targets.some(
                      (item) =>
                        item.targetId === target.targetId &&
                        item.targetType === target.targetType
                    )
                )
                .map((target) => (
                  <li key={`${target.targetType}-${target.targetId}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setValue({
                          ...value,
                          targets: [
                            ...value.targets,
                            {
                              targetId: target.targetId,
                              targetType: target.targetType,
                              canRead: true,
                              canPost: true,
                              canManage: false,
                            },
                          ],
                        })
                        setSearch("")
                        setAdding(false)
                      }}
                    >
                      <span className="truncate">{target.displayName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {target.targetType === "member"
                          ? "メンバー"
                          : target.targetType === "role"
                            ? "ロール"
                            : "シフト"}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {value.targets.map((target, index) => {
            const name =
              targets.find(
                (item) =>
                  item.targetType === target.targetType &&
                  item.targetId === target.targetId
              )?.displayName ?? "対象を確認できません"
            const permissions =
              [
                target.canRead || target.canPost || target.canManage
                  ? "閲覧"
                  : null,
                target.canPost || target.canManage ? "投稿" : null,
                target.canManage ? "設定変更" : null,
              ]
                .filter(Boolean)
                .join("・") || "権限なし"
            return (
              <div
                key={`${target.targetType}-${target.targetId}`}
                className="flex items-start gap-2 py-2"
              >
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="mt-1 block pl-4 text-xs text-muted-foreground">
                      {permissions}
                    </span>
                  </summary>
                  <div className="flex flex-wrap gap-4 pt-3 pl-4">
                    {(
                      [
                        { key: "canRead", label: "閲覧" },
                        { key: "canPost", label: "投稿" },
                        { key: "canManage", label: "設定変更" },
                      ] as const
                    ).map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={target[key]}
                          onChange={(event) =>
                            setValue({
                              ...value,
                              targets: value.targets.map((item, i) =>
                                i === index
                                  ? { ...item, [key]: event.target.checked }
                                  : item
                              ),
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </details>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${name}の追加設定を削除`}
                  onClick={() =>
                    setValue({
                      ...value,
                      targets: value.targets.filter((_, i) => i !== index),
                    })
                  }
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )
          })}
          {!value.targets.length && (
            <p className="py-3 text-xs text-muted-foreground">
              追加の設定はありません
            </p>
          )}
        </div>
      </div>
      {initial.kind === "custom" && (
        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setValue({ ...value, closed: !value.closed })}
          >
            {value.closed ? "アーカイブから戻す" : "アーカイブする"}
          </Button>
          {value.closed && (
            <p className="mt-2 text-xs text-muted-foreground">
              保存するとアーカイブされ、履歴の閲覧のみになります。
            </p>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={() => void save()}>保存</Button>
      </div>
    </fieldset>
  )
}
