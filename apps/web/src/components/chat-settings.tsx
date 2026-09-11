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
      {settings.isError && <p role="alert">{errorMessage(settings.error)}</p>}
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
    <div className="space-y-4">
      <Input
        aria-label="ルーム名"
        value={value.name}
        onChange={(event) => setValue({ ...value, name: event.target.value })}
      />
      <Input
        aria-label="宛先を検索"
        placeholder="宛先を検索"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-72 overflow-auto">
        {targets
          .filter((target) => target.displayName.includes(search))
          .map((target) => {
            const existing = value.targets.find(
              (item) =>
                item.targetId === target.targetId &&
                item.targetType === target.targetType
            )
            return (
              <div
                key={`${target.targetType}-${target.targetId}`}
                className="border-b py-3"
              >
                <p className="mb-2 text-sm">{target.displayName}</p>
                <div className="flex gap-4">
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
                        checked={existing?.[key] ?? false}
                        onChange={(event) =>
                          setValue({
                            ...value,
                            targets: [
                              ...value.targets.filter(
                                (item) =>
                                  item.targetId !== target.targetId ||
                                  item.targetType !== target.targetType
                              ),
                              {
                                targetId: target.targetId,
                                targetType: target.targetType,
                                canRead: existing?.canRead ?? false,
                                canPost: existing?.canPost ?? false,
                                canManage: existing?.canManage ?? false,
                                [key]: event.target.checked,
                              },
                            ],
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
      <label className="flex items-center justify-between text-sm">
        ルームを閉じる
        <input
          type="checkbox"
          checked={value.closed}
          onChange={(event) =>
            setValue({ ...value, closed: event.target.checked })
          }
        />
      </label>
      <Button disabled={pending} onClick={() => void save()}>
        保存
      </Button>
    </div>
  )
}
