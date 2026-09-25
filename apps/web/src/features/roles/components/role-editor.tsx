import { useEffect, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { ShiftPermission } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  createYearRole,
  updateRole,
  deleteRole,
} from "@/features/years/api/years"
import { errorMessage } from "@/lib/http/client"
import { keys } from "@/app/data/keys"
import { refreshMemberships } from "@/app/data/sync"
import { permissions, type Role } from "./role-permissions"

export function RoleEditor({
  year,
  role,
  canEdit,
  grantable,
  onDirtyChange,
  onClose,
}: {
  year: number
  role: Role | null
  canEdit: boolean
  grantable: ShiftPermission[]
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
}) {
  const client = useQueryClient()
  const [name, setName] = useState(role?.name ?? "")
  const [color, setColor] = useState(role?.color ?? "#64748B")
  const [grants, setGrants] = useState<ShiftPermission[]>(
    role?.permissions ?? []
  )
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const dirty =
    name !== (role?.name ?? "") ||
    color !== (role?.color ?? "#64748B") ||
    grants.length !== (role?.permissions.length ?? 0) ||
    grants.some((grant) => !role?.permissions.includes(grant))
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  function close() {
    if (dirty) setDiscarding(true)
    else onClose()
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      const input = { name, color, permissions: grants }
      if (role) await updateRole(role.id, input)
      else await createYearRole(year, input)
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.yearRoles(year) }),
        client.invalidateQueries({ queryKey: keys.years() }),
        client.invalidateQueries({ queryKey: keys.roster(year) }),
      ])
      toast.success("ロールを保存しました。")
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={save} className="mx-auto max-w-2xl min-w-0 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">
          {role?.name ?? "ロールを作成"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={close}
        >
          一覧に戻る
        </Button>
      </div>
      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          このロールを編集する権限がありません。
        </p>
      )}
      <fieldset disabled={!canEdit || pending} className="space-y-6">
        <div className="flex items-end gap-3">
          <label
            htmlFor="role-name"
            className="flex flex-1 flex-col gap-2 text-sm"
          >
            ロール名
            <Input
              id="role-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor="role-color" className="flex flex-col gap-2 text-sm">
            色
            <Input
              id="role-color"
              type="color"
              aria-label="ロールの色"
              className="w-12 p-1"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
        </div>
        <fieldset className="divide-y">
          <legend className="pb-2 text-xs text-muted-foreground">
            操作権限
          </legend>
          {permissions.map(({ value, label }) => (
            <label
              key={value}
              className="flex min-h-12 items-center gap-3 text-sm"
            >
              <input
                className="accent-foreground"
                type="checkbox"
                disabled={!grantable.includes(value)}
                checked={grants.includes(value)}
                onChange={(event) =>
                  setGrants(
                    event.target.checked
                      ? [...grants, value]
                      : grants.filter((item) => item !== value)
                  )
                }
              />
              <span>{label}</span>
              {!grantable.includes(value) && (
                <span className="ml-auto text-xs text-muted-foreground">
                  変更不可
                </span>
              )}
            </label>
          ))}
        </fieldset>
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {dirty && (
            <span className="mr-auto text-xs text-muted-foreground">
              未保存の変更
            </span>
          )}
          <Button type="button" variant="outline" onClick={close}>
            キャンセル
          </Button>
          <Button type="submit" disabled={pending || !dirty || !name.trim()}>
            {pending ? "保存中…" : role ? "保存" : "作成"}
          </Button>
        </div>
      </fieldset>
      {role && canEdit && (
        <div className="border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setDeleting(true)}
          >
            ロールを削除
          </Button>
        </div>
      )}
      {discarding && (
        <ConfirmDialog
          title="変更を破棄しますか"
          confirmLabel="破棄して戻る"
          onCancel={() => setDiscarding(false)}
          onConfirm={onClose}
        />
      )}
      {deleting && role && (
        <ConfirmDialog
          title={`「${role.name}」を削除しますか`}
          description="このロールのメンバーへの付与、シフトの責任者指定、チャットの対象指定も解除されます。"
          confirmLabel="削除"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false)
            setPending(true)
            void deleteRole(role.id)
              .then(async () => {
                await refreshMemberships(client)
                onClose()
              })
              .catch((error) => toast.error(errorMessage(error)))
              .finally(() => setPending(false))
          }}
        />
      )}
    </form>
  )
}
