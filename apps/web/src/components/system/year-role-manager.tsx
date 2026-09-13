import { refreshMemberships } from "@/data/sync"
import { keys } from "@/data/keys"
import { rolesQuery } from "@/data/years"
import { ArrowUp, ArrowDown } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ShiftPermission } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  createYearRole,
  updateRole,
  reorderRoles,
  deleteRole,
} from "@/api/years"
import { errorMessage } from "@/api/client"

const permissions: { value: ShiftPermission; label: string }[] = [
  { value: "shift.create", label: "シフト作成" },
  { value: "shift.manage", label: "全シフト管理" },
  { value: "member.manage", label: "メンバー管理" },
  { value: "role.manage", label: "ロール管理" },
]
type Role = {
  id: string
  name: string
  color: string
  permissions: ShiftPermission[]
}
export function YearRoleManager({ year }: { year: number }) {
  const query = useQuery({
    ...rolesQuery(year),
  })
  const client = useQueryClient()
  const [ordering, setOrdering] = useState(false)
  const authority = query.data?.authority
  const editable = (position: number) =>
    !!authority &&
    (authority.systemAdmin ||
      (authority.permissions.includes("role.manage") &&
        position < (authority.position ?? Number.NEGATIVE_INFINITY)))
  async function move(index: number, delta: number) {
    const ids = query.data?.roles.map((item) => item.id),
      other = ids?.[index + delta],
      id = ids?.[index]
    if (!ids || !other || !id) return
    ids[index] = other
    ids[index + delta] = id
    setOrdering(true)
    try {
      await reorderRoles(year, ids)
      await client.invalidateQueries({ queryKey: keys.yearRoles(year) })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setOrdering(false)
    }
  }
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const role = query.data?.roles.find((item) => item.id === selected)
  return (
    <div className="grid min-h-80 md:grid-cols-[15rem_1fr]">
      <div
        className={`${role || creating ? "hidden md:block" : ""} border-border/70 md:border-r md:pr-4`}
      >
        <Button
          variant="ghost"
          size="sm"
          className="mb-3"
          disabled={
            !authority ||
            (!authority.systemAdmin &&
              !authority.permissions.includes("role.manage"))
          }
          onClick={() => {
            setSelected(null)
            setCreating(true)
          }}
        >
          ロールを作成
        </Button>
        <ul className="space-y-1">
          {query.data?.roles.map((item, index) => (
            <li key={item.id} className="flex items-center">
              <button
                type="button"
                aria-current={selected === item.id || undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm ${selected === item.id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setSelected(item.id)
                  setCreating(false)
                }}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.name}</span>
              </button>
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${item.name}を上へ`}
                  disabled={
                    ordering ||
                    !editable(item.position) ||
                    !editable(
                      query.data?.roles[index - 1]?.position ?? Infinity
                    )
                  }
                  onClick={() => void move(index, -1)}
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${item.name}を下へ`}
                  disabled={
                    ordering ||
                    index === (query.data?.roles.length ?? 0) - 1 ||
                    !editable(item.position) ||
                    !editable(
                      query.data?.roles[index + 1]?.position ?? Infinity
                    )
                  }
                  onClick={() => void move(index, 1)}
                >
                  <ArrowDown className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="md:pl-8">
        {role || creating ? (
          <RoleEditor
            key={role?.id ?? "new"}
            year={year}
            role={role ?? null}
            canEdit={
              role
                ? editable(role.position)
                : !!authority &&
                  (authority.systemAdmin ||
                    authority.permissions.includes("role.manage"))
            }
            grantable={
              authority?.systemAdmin
                ? permissions.map((p) => p.value)
                : (authority?.permissions ?? [])
            }
            onClose={() => {
              setSelected(null)
              setCreating(false)
            }}
          />
        ) : (
          <p className="hidden py-8 text-sm text-muted-foreground md:block">
            ロールを選択してください
          </p>
        )}
      </div>
    </div>
  )
}
function RoleEditor({
  year,
  role,
  canEdit,
  grantable,
  onClose,
}: {
  year: number
  role: Role | null
  canEdit: boolean
  grantable: ShiftPermission[]
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
      if (!role) onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={save} className="min-w-0 space-y-6">
      <fieldset disabled={!canEdit || pending} className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="md:hidden"
        >
          一覧に戻る
        </Button>
        <div className="flex items-end gap-3">
          <label htmlFor="role-name" className="flex-1 space-y-2 text-sm">
            名前
            <Input
              id="role-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Input
            type="color"
            aria-label="ロールの色"
            className="w-12 p-1"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
        <fieldset className="divide-y">
          <legend className="pb-2 text-xs text-muted-foreground">
            操作権限
          </legend>
          {permissions.map(({ value, label }) => (
            <label
              key={value}
              className="flex min-h-12 items-center justify-between gap-3 text-sm"
            >
              {label}
              <input
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
            </label>
          ))}
        </fieldset>
        <div className="flex justify-between">
          <Button type="submit" disabled={pending}>
            保存
          </Button>
          {role && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleting(true)}
            >
              ロールを削除
            </Button>
          )}
        </div>
      </fieldset>
      {deleting && role && (
        <ConfirmDialog
          title="ロールを削除しますか"
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
