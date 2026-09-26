import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { rolesQuery } from "@/features/years/data/years"
import { keys } from "@/app/data/keys"
import { reorderRoles } from "@/features/years/api/years"
import { errorMessage } from "@/lib/http/client"
import { permissions } from "./role-permissions"
import { RoleEditor } from "./role-editor"

export function YearRoleManager({
  year,
  onDirtyChange,
}: {
  year: number
  onDirtyChange: (dirty: boolean) => void
}) {
  const query = useQuery({
    ...rolesQuery(year),
  })
  const client = useQueryClient()
  const [ordering, setOrdering] = useState(false)
  const [reordering, setReordering] = useState(false)
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
  const canCreate =
    !!authority &&
    (authority.systemAdmin || authority.permissions.includes("role.manage"))
  if (role || creating)
    return (
      <RoleEditor
        key={role?.id ?? "new"}
        year={year}
        role={role ?? null}
        canEdit={role ? editable(role.position) : canCreate}
        grantable={
          authority?.systemAdmin
            ? permissions.map((p) => p.value)
            : (authority?.permissions ?? [])
        }
        onDirtyChange={onDirtyChange}
        onClose={() => {
          setSelected(null)
          setCreating(false)
        }}
      />
    )
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={!canCreate || ordering}
          onClick={() => setReordering(!reordering)}
        >
          {reordering ? "並べ替えを終了" : "並べ替え"}
        </Button>
        <Button
          variant="outline"
          disabled={!canCreate || ordering || reordering}
          onClick={() => setCreating(true)}
        >
          ロールを作成
        </Button>
      </div>
      {query.isPending && (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      )}
      {query.isError && (
        <p role="alert">
          ロールを取得できませんでした。
          <Button variant="ghost" onClick={() => void query.refetch()}>
            再試行
          </Button>
        </p>
      )}
      {reordering && (
        <p className="text-sm text-muted-foreground">
          ロール管理の権限がある人は、自分より下のロールを編集できます。
        </p>
      )}
      <ul className="divide-y border-y">
        {query.data?.roles.map((item, index) => (
          <li key={item.id} className="flex min-h-16 items-center gap-3 py-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {permissions
                  .filter((p) => item.permissions.includes(p.value))
                  .map((p) => p.label)
                  .join("・") || "管理権限なし"}
              </p>
            </div>
            {reordering ? (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`${item.name}を上へ`}
                  disabled={
                    ordering ||
                    index === 0 ||
                    !editable(item.position) ||
                    !editable(
                      query.data?.roles[index - 1]?.position ?? Infinity
                    )
                  }
                  onClick={() => void move(index, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="outline"
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
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                aria-label={`${item.name}を${editable(item.position) ? "編集" : "表示"}`}
                onClick={() => setSelected(item.id)}
              >
                {editable(item.position) ? "編集" : "表示"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {query.data?.roles.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          ロールがありません。
        </p>
      )}
    </div>
  )
}
