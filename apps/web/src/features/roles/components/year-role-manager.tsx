import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowUp, ArrowDown } from "lucide-react"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { rolesQuery } from "@/features/years/data/years"
import { keys } from "@/app/data/keys"
import { reorderRoles } from "@/features/years/api/years"
import { errorMessage } from "@/lib/http/client"
import { permissions } from "./role-permissions"

export function YearRoleManager({
  year,
  view,
}: {
  year: number
  view: { search: string }
}) {
  const query = useQuery({
    ...rolesQuery(year),
  })
  const client = useQueryClient()
  const [ordering, setOrdering] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [search, setSearch] = useState(() => view.search)
  const authority = query.data?.authority
  const roles = query.data?.roles ?? []
  const visible = reordering
    ? roles
    : roles.filter((role) =>
        role.name.toLowerCase().includes(search.toLowerCase())
      )
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
  const canCreate =
    !!authority &&
    (authority.systemAdmin || authority.permissions.includes("role.manage"))
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background py-4">
        <Input
          className="h-9 w-full sm:max-w-80"
          aria-label="ロールを検索"
          placeholder="ロール名で検索"
          disabled={reordering}
          value={search}
          onChange={(event) => {
            view.search = event.target.value
            setSearch(event.target.value)
          }}
        />
        <span className="text-sm text-muted-foreground">
          {visible.length} / {roles.length}件
        </span>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          disabled={!canCreate || ordering}
          onClick={() => {
            if (!reordering) {
              view.search = ""
              setSearch("")
            }
            setReordering(!reordering)
          }}
        >
          {reordering ? "並べ替えを終了" : "並べ替え"}
        </Button>
        {canCreate && !ordering && !reordering ? (
          <Link
            to="/manage/roles/$year/new"
            params={{ year: String(year) }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ロールを作成
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            ロールを作成
          </Button>
        )}
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
        {visible.map((item, index) => (
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
              <Link
                to="/manage/roles/$year/$roleId"
                params={{ year: String(year), roleId: item.id }}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label={`${item.name}を${editable(item.position) ? "編集" : "表示"}`}
              >
                {editable(item.position) ? "編集" : "表示"}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {query.data?.roles.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          ロールがありません。
        </p>
      )}
      {query.data && roles.length > 0 && visible.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          条件に一致するロールがありません。
        </p>
      )}
    </div>
  )
}
