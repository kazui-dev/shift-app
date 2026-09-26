import { MemberAvatar } from "@/features/members/components/member-avatar"
import { keys } from "@/app/data/keys"
import { membershipsQuery, yearsQuery } from "@/features/years/data/years"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  activateYearMembership,
  getYearMemberships,
  getRoster,
  getYearRoles,
  createYearRole,
  changeMemberRoles,
} from "@/features/years/api/years"
import { errorMessage } from "@/lib/http/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { SelectField } from "@/components/select-field"
export function AddMembers({
  year,
  onClose,
}: {
  year: number
  onClose: () => void
}) {
  const client = useQueryClient()
  const years = useQuery({ ...yearsQuery })
  const [source, setSource] = useState(year)
  const query = useQuery({
    queryKey: keys.yearMemberships(source),
    queryFn: () => getYearMemberships(source),
  })
  const current = useQuery({
    ...membershipsQuery(year),
  })
  const [copyRoleIds, setCopyRoleIds] = useState<string[]>([])
  const sourceRoles = useQuery({
    queryKey: keys.yearRoles(source),
    queryFn: () => getYearRoles(source),
    enabled: source !== year,
  })
  const sourceRoster = useQuery({
    queryKey: keys.roster(source),
    queryFn: () => getRoster(source),
    enabled: source !== year,
  })
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const items =
    query.data?.memberships.filter(
      (item) =>
        (source === year
          ? item.status !== "active"
          : item.status === "active" &&
            !current.data?.memberships.some(
              (existing) =>
                existing.member.id === item.member.id &&
                existing.status === "active"
            )) &&
        `$<MemberAvatar name={item.member.displayName} image={item.member.image} />
                  {item.member.displayName} ${item.member.studentId}`
          .toLowerCase()
          .includes(search.toLowerCase())
    ) ?? []
  async function add() {
    setPending(true)
    const roleMap = new Map<string, string>()
    try {
      if (copyRoleIds.length) {
        const existing = await getYearRoles(year)
        await Promise.all(
          copyRoleIds.map(async (sourceId) => {
            const role = sourceRoles.data?.roles.find(
              (item) => item.id === sourceId
            )
            if (!role) throw new Error("コピー元のロールが見つかりません。")
            const target = existing.roles.find(
              (item) => item.name === role.name
            )
            roleMap.set(
              sourceId,
              target?.id ??
                (
                  await createYearRole(year, {
                    name: role.name,
                    color: role.color,
                    permissions: role.permissions,
                  })
                ).role.id
            )
          })
        )
      }
    } catch (error) {
      toast.error(errorMessage(error))
      setPending(false)
      return
    }
    const results = await Promise.allSettled(
      selected.map(async (id) => {
        await activateYearMembership(year, id)
        const addRoleIds =
          sourceRoster.data?.members
            .find((member) => member.id === id)
            ?.roles.flatMap((role) => {
              const target = roleMap.get(role.id)
              return target ? [target] : []
            }) ?? []
        if (addRoleIds.length)
          await changeMemberRoles(year, {
            memberIds: [id],
            addRoleIds,
            removeRoleIds: [],
          })
      })
    )
    const failed = selected.filter(
      (_, index) => results[index]?.status === "rejected"
    )
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.yearMemberships(year) }),
      client.invalidateQueries({ queryKey: keys.roster(year) }),
      client.invalidateQueries({ queryKey: keys.yearRoles(year) }),
    ])
    setSelected(failed)
    setPending(false)
    if (failed.length)
      toast.error(
        `${failed.length}人の追加に失敗しました。選択したまま残しています。`
      )
    else {
      toast.success("メンバーを追加しました。")
      onClose()
    }
  }
  return (
    <ResponsiveDialog
      open
      title="メンバーを追加"
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <div className="space-y-4">
        <SelectField
          aria-label="追加元"
          value={source}
          onValueChange={(value) => {
            setSource(Number(value))
            setSelected([])
            setCopyRoleIds([])
          }}
          options={[
            { value: year, label: "未参加のユーザー" },
            ...(years.data?.years ?? [])
              .filter((y) => y.year < year && y.canManage)
              .map((y) => ({ value: y.year, label: `${y.year}から選ぶ` })),
          ]}
        />
        <Input
          placeholder="名前・学籍番号で検索"
          aria-label="ユーザーを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="max-h-80 divide-y overflow-auto">
          {items.map((item) => (
            <li key={item.member.id}>
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(item.member.id)}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, item.member.id]
                        : ids.filter((id) => id !== item.member.id)
                    )
                  }
                />
                <span className="flex min-w-0 items-center gap-3 text-sm">
                  <MemberAvatar
                    name={item.member.displayName}
                    image={item.member.image}
                  />
                  {item.member.displayName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.member.studentId}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {source !== year && sourceRoles.data && (
          <details className="space-y-2 text-sm">
            <summary className="cursor-pointer">ロールも引き継ぐ</summary>
            <p className="text-xs text-muted-foreground">
              選んだロールと、追加するメンバーへの付与を引き継ぎます。同名のロールがある場合はそのロールを使います。
            </p>
            {sourceRoles.data.roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={copyRoleIds.includes(role.id)}
                  disabled={pending}
                  onChange={(event) =>
                    setCopyRoleIds((ids) =>
                      event.target.checked
                        ? [...ids, role.id]
                        : ids.filter((id) => id !== role.id)
                    )
                  }
                />
                {role.name}
              </label>
            ))}
          </details>
        )}
        <Button
          disabled={
            pending ||
            !selected.length ||
            (copyRoleIds.length > 0 && !sourceRoster.data)
          }
          onClick={() => void add()}
        >
          {selected.length ? `${selected.length}人を追加` : "追加"}
        </Button>
      </div>
    </ResponsiveDialog>
  )
}
