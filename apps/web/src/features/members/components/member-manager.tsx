import { MemberAvatar } from "@/features/members/components/member-avatar"
import { keys } from "@/app/data/keys"
import { refreshMemberships } from "@/app/data/sync"
import { rosterQuery, rolesQuery } from "@/features/years/data/years"
import { AddMembers } from "./add-members"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  changeMemberRoles,
  deactivateYearMembership,
} from "@/features/years/api/years"
import { errorMessage } from "@/lib/http/client"
import { SelectField } from "@/components/select-field"
import { ResponsiveDialog } from "@/components/responsive-overlay"

export function MemberManager({
  year,
  view,
  onDirtyChange,
}: {
  year: number
  view: { search: string; filter: string }
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const roster = useQuery({
    ...rosterQuery(year),
  })
  const roles = useQuery({
    ...rolesQuery(year),
  })
  const [adding, setAdding] = useState(false)
  const [leaving, setLeaving] = useState<string | null>(null)
  const [search, setSearch] = useState(() => view.search)
  const [filter, setFilter] = useState(() => view.filter)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<string[] | null>(null)
  const [add, setAdd] = useState<string[]>([])
  const [remove, setRemove] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [addMembersDirty, setAddMembersDirty] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const roleDirty = editing !== null && (add.length > 0 || remove.length > 0)
  useEffect(() => {
    onDirtyChange(roleDirty || addMembersDirty || pending)
    return () => onDirtyChange(false)
  }, [roleDirty, addMembersDirty, pending, onDirtyChange])
  const members =
    roster.data?.members.filter(
      (member) =>
        `${member.displayName} ${member.studentId}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!filter || member.roles.some((role) => role.id === filter))
    ) ?? []
  function edit(ids: string[]) {
    setEditing(ids)
    setAdd([])
    setRemove([])
  }
  async function apply() {
    if (!editing) return
    setPending(true)
    try {
      await changeMemberRoles(year, {
        memberIds: editing,
        addRoleIds: add,
        removeRoleIds: remove,
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.roster(year) }),
        client.invalidateQueries({ queryKey: keys.yearRoles(year) }),
        client.invalidateQueries({ queryKey: keys.years() }),
      ])
      setEditing(null)
      setSelected([])
      toast.success("ロールを更新しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background py-4">
        <Input
          className="h-9 w-full sm:max-w-80"
          aria-label="メンバーを検索"
          placeholder="名前・学籍番号で検索"
          value={search}
          onChange={(event) => {
            view.search = event.target.value
            setSearch(event.target.value)
          }}
        />
        <SelectField
          aria-label="ロールで絞り込み"
          className="h-9 w-auto"
          value={filter}
          onValueChange={(value) => {
            view.filter = value
            setFilter(value)
          }}
          options={[
            { value: "", label: "すべてのロール" },
            ...(roles.data?.roles ?? []).map((role) => ({
              value: role.id,
              label: role.name,
            })),
          ]}
        />
        <span className="text-sm text-muted-foreground">
          {members.length} / {roster.data?.members.length ?? 0}人
        </span>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
        >
          メンバーを追加
        </Button>
      </div>
      {roster.isError && (
        <p role="alert" className="text-sm">
          メンバーを読み込めませんでした。
          <Button variant="ghost" onClick={() => void roster.refetch()}>
            再読み込み
          </Button>
        </p>
      )}
      {roster.isPending && (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      )}
      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <span className="mr-auto">{selected.length}人選択中</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            選択を解除
          </Button>
          <Button variant="ghost" size="sm" onClick={() => edit(selected)}>
            ロールを変更
          </Button>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <input
          type="checkbox"
          aria-label="表示中のメンバーをすべて選択"
          checked={
            members.length > 0 &&
            members.every((member) => selected.includes(member.id))
          }
          disabled={members.length === 0}
          onChange={(event) =>
            setSelected(
              event.target.checked
                ? [
                    ...new Set([
                      ...selected,
                      ...members.map((member) => member.id),
                    ]),
                  ]
                : selected.filter(
                    (id) => !members.some((member) => member.id === id)
                  )
            )
          }
        />
        <span className="flex-1">名前・学籍番号</span>
        <span>ロール / 操作</span>
      </div>
      {!roster.isPending && !roster.isError && members.length === 0 && (
        <p className="py-8 text-sm text-muted-foreground">
          条件に一致するメンバーはいません。
        </p>
      )}
      <ul className="divide-y border-y">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex min-h-16 items-center gap-3 py-3 text-sm sm:gap-4"
          >
            <input
              type="checkbox"
              aria-label={`${member.displayName}を選択`}
              checked={selected.includes(member.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, member.id]
                    : selected.filter((id) => id !== member.id)
                )
              }
            />
            <MemberAvatar name={member.displayName} image={member.image} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{member.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {member.studentId}
              </p>
            </div>
            <button
              className="max-w-1/2 py-2 text-right text-sm text-muted-foreground"
              onClick={() => edit([member.id])}
            >
              {member.roles.map((role) => role.name).join("、") ||
                "ロールを設定"}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeaving(member.id)}
            >
              参加解除
            </Button>
          </li>
        ))}
      </ul>
      {adding && (
        <AddMembers
          year={year}
          onDirtyChange={setAddMembersDirty}
          onClose={() => {
            setAdding(false)
            setAddMembersDirty(false)
          }}
        />
      )}
      {leaving && (
        <ConfirmDialog
          title="年度への参加を解除しますか"
          confirmLabel="参加解除"
          onCancel={() => setLeaving(null)}
          onConfirm={() => {
            const id = leaving
            setLeaving(null)
            void deactivateYearMembership(year, id)
              .then(() => refreshMemberships(client))
              .catch((error) => toast.error(errorMessage(error)))
          }}
        />
      )}
      {editing && (
        <ResponsiveDialog
          open
          title="ロールを変更"
          onOpenChange={(open) => {
            if (!open && !pending) {
              if (roleDirty) setDiscarding(true)
              else setEditing(null)
            }
          }}
        >
          <div className="space-y-4">
            {editing.length > 1 && (
              <p className="text-sm text-muted-foreground">
                {editing.length}人に適用
              </p>
            )}
            {roles.data?.roles.map((role) => (
              <label
                key={role.id}
                className="flex items-center justify-between gap-3"
              >
                <span>{role.name}</span>
                <SelectField
                  className="w-auto"
                  value={
                    add.includes(role.id)
                      ? "add"
                      : remove.includes(role.id)
                        ? "remove"
                        : "keep"
                  }
                  onValueChange={(value) => {
                    setAdd((ids) => [
                      ...ids.filter((id) => id !== role.id),
                      ...(value === "add" ? [role.id] : []),
                    ])
                    setRemove((ids) => [
                      ...ids.filter((id) => id !== role.id),
                      ...(value === "remove" ? [role.id] : []),
                    ])
                  }}
                  options={[
                    { value: "keep", label: "変更しない" },
                    { value: "add", label: "追加" },
                    { value: "remove", label: "解除" },
                  ]}
                />
              </label>
            ))}
            <Button
              disabled={pending || add.length + remove.length === 0}
              onClick={() => void apply()}
            >
              適用
            </Button>
          </div>
        </ResponsiveDialog>
      )}
      {discarding && (
        <ConfirmDialog
          title="変更を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setDiscarding(false)}
          onConfirm={() => {
            setDiscarding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
