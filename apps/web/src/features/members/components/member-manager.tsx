import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/lib/toast"
import { refreshMemberships } from "@/app/data/sync"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { rosterQuery, rolesQuery } from "@/features/years/data/years"
import { deactivateYearMembership } from "@/features/years/api/years"
import { errorMessage } from "@/lib/http/client"
import { tagsQuery } from "../data/tags"
import { AddMembers } from "./add-members"
import { MemberAvatar } from "./member-avatar"
import { MemberLabels } from "./member-labels"
import { FilterMenu } from "@workspace/ui/components/filter-menu"
import {
  emptyFilter,
  matchesFilter,
  type FilterValue,
} from "@workspace/ui/lib/filters"
import { MemberRoleEditor } from "./member-role-editor"
import { MemberTagEditor } from "./member-tag-editor"
import { TagManager } from "./tag-manager"
import type { ManagementScreenView } from "@/features/management/management-context"

export function MemberManager({
  year,
  view,
  onDirtyChange,
}: {
  year: number
  view: {
    search: string
    filter: string
    filters?: Record<string, FilterValue> | undefined
    sort?: ManagementScreenView["sort"]
    save: (
      patch: Partial<{
        search: string
        filter: string
        filters: Record<string, FilterValue>
        sort: NonNullable<ManagementScreenView["sort"]>
      }>
    ) => void
  }
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const roster = useQuery(rosterQuery(year))
  const roles = useQuery(rolesQuery(year))
  const tags = useQuery(tagsQuery(year))
  const search = view.search
  const roleFilter = view.filters?.roles ?? emptyFilter()
  const tagFilter = view.filters?.tags ?? emptyFilter()
  const sort = view.sort ?? { column: "studentId", descending: false }
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<{
    kind: "role" | "tag"
    ids: string[]
  } | null>(null)
  const [managingTags, setManagingTags] = useState(false)
  const [adding, setAdding] = useState(false)
  const [leaving, setLeaving] = useState<string[] | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const [addMembersDirty, setAddMembersDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [failures, setFailures] = useState<{ id: string; message: string }[]>(
    []
  )
  useEffect(() => {
    onDirtyChange(editorDirty || addMembersDirty || pending)
    return () => onDirtyChange(false)
  }, [editorDirty, addMembersDirty, pending, onDirtyChange])
  const memberTags = new Map<string, { id: string; name: string }[]>()
  for (const tag of tags.data?.tags ?? []) {
    for (const id of tag.memberIds) {
      const assigned = memberTags.get(id) ?? []
      assigned.push(tag)
      memberTags.set(id, assigned)
    }
  }
  const members = (roster.data?.members ?? [])
    .filter((member) => {
      const assignedTags = memberTags.get(member.id) ?? []
      return (
        `${member.displayName} ${member.studentId}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()) &&
        matchesFilter(
          member.roles.map((role) => role.id),
          roleFilter
        ) &&
        matchesFilter(
          assignedTags.map((tag) => tag.id),
          tagFilter
        )
      )
    })
    .toSorted(
      (a, b) =>
        a[sort.column].localeCompare(b[sort.column], "ja", { numeric: true }) *
        (sort.descending ? -1 : 1)
    )
  const hiddenSelected = selected.filter(
    (id) => !members.some((member) => member.id === id)
  ).length
  const roleItems = (roles.data?.roles ?? []).map((role) => ({
    ...role,
    memberIds: (roster.data?.members ?? [])
      .filter((member) => member.roles.some((item) => item.id === role.id))
      .map((member) => member.id),
  }))
  function applied() {
    setEditing(null)
    setSelected([])
  }
  function sortBy(column: "displayName" | "studentId") {
    view.save({
      sort: {
        column,
        descending: sort.column === column ? !sort.descending : false,
      },
    })
  }
  function clearFilters() {
    view.save({
      search: "",
      filters: { roles: emptyFilter(), tags: emptyFilter() },
    })
  }
  async function leave(ids: string[]) {
    setPending(true)
    setFailures([])
    try {
      const results = await Promise.allSettled(
        ids.map((id) => deactivateYearMembership(year, id))
      )
      const failed = results.flatMap((result, index) => {
        const id = ids[index]
        return result.status === "rejected" && id
          ? [{ id, message: errorMessage(result.reason) }]
          : []
      })
      setFailures(failed)
      setSelected(failed.map((item) => item.id))
      await refreshMemberships(client)
      const count = ids.length - failed.length
      if (count) toast.success(`${count}人の年度への参加を解除しました。`)
      if (failed.length)
        toast.error(`${failed.length}人の参加を解除できませんでした。`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  const activeFilters = Boolean(
    search || roleFilter.values.length || tagFilter.values.length
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 pt-4">
        <Input
          className="w-full sm:w-72"
          type="search"
          aria-label="メンバーを検索"
          placeholder="名前・学籍番号で検索"
          value={search}
          onChange={(event) => {
            view.save({ search: event.target.value })
          }}
        />
        {activeFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            絞り込みを解除
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            disabled={pending}
            render={<Link to="/manage/roles" />}
          >
            ロールを管理
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !tags.data || tags.isError}
            onClick={() => setManagingTags(true)}
          >
            タグを管理
          </Button>
          <Button size="sm" disabled={pending} onClick={() => setAdding(true)}>
            <Plus />
            メンバーを追加
          </Button>
        </div>
      </div>
      {tags.isError && (
        <p role="alert" className="text-sm">
          タグを読み込めませんでした。
          <Button
            size="sm"
            variant="outline"
            onClick={() => void tags.refetch()}
          >
            再読み込み
          </Button>
        </p>
      )}
      {roles.isError && (
        <p role="alert" className="text-sm">
          ロールを読み込めませんでした。
          <Button
            size="sm"
            variant="outline"
            onClick={() => void roles.refetch()}
          >
            再読み込み
          </Button>
        </p>
      )}
      {roster.isError && (
        <p role="alert" className="text-sm">
          メンバーを読み込めませんでした。
          <Button
            size="sm"
            variant="outline"
            onClick={() => void roster.refetch()}
          >
            再読み込み
          </Button>
        </p>
      )}
      {failures.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-sm"
        >
          <p className="font-medium">参加解除できなかったメンバー</p>
          <ul className="mt-2 space-y-1">
            {failures.map((failure) => (
              <li key={failure.id}>
                {roster.data?.members.find((member) => member.id === failure.id)
                  ?.displayName ?? failure.id}
                ：{failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border">
        <div
          className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2 text-sm"
          aria-label="メンバーの操作"
        >
          {selected.length ? (
            <>
              <span className="mr-1 font-medium">
                {selected.length}人選択中
                {hiddenSelected > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    （表示外{hiddenSelected}人）
                  </span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || roles.isPending || roles.isError}
                onClick={() => setEditing({ kind: "role", ids: selected })}
              >
                ロールを変更
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || !tags.data || tags.isError}
                onClick={() => setEditing({ kind: "tag", ids: selected })}
              >
                タグを変更
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => setLeaving(selected)}
              >
                参加解除
              </Button>
              <Button
                className="ml-auto"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setSelected([])}
              >
                選択を解除
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">
              {members.length} / {roster.data?.members.length ?? 0}人
            </span>
          )}
        </div>
        <Table aria-label="メンバー一覧" className="min-w-190 table-fixed">
          <colgroup>
            <col className="w-12" />
            <col className="w-[22%]" />
            <col className="w-32" />
            <col className="w-[32%]" />
            <col />
          </colgroup>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4" scope="col">
                <input
                  className="size-4 accent-primary"
                  type="checkbox"
                  aria-label="表示中のメンバーをすべて選択"
                  disabled={pending || members.length === 0}
                  checked={
                    members.length > 0 &&
                    members.every((member) => selected.includes(member.id))
                  }
                  ref={(input) => {
                    if (input)
                      input.indeterminate =
                        members.some((member) =>
                          selected.includes(member.id)
                        ) &&
                        !members.every((member) => selected.includes(member.id))
                  }}
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
              </TableHead>
              {(["displayName", "studentId"] as const).map((column) => (
                <TableHead
                  key={column}
                  className="px-3 py-2"
                  scope="col"
                  aria-sort={
                    sort.column === column
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="flex h-6 items-center gap-2 text-xs"
                    onClick={() => sortBy(column)}
                  >
                    {column === "displayName" ? "名前" : "学籍番号"}
                    {sort.column === column ? (
                      sort.descending ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
              ))}
              <TableHead scope="col" className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">ロール</span>
                  <FilterMenu
                    iconOnly
                    label="ロール"
                    value={roleFilter}
                    options={[
                      { value: "unset", label: "未設定" },
                      ...(roles.data?.roles ?? []).map((role) => ({
                        value: role.id,
                        label: role.name,
                      })),
                    ]}
                    disabled={roles.isPending || roles.isError}
                    optionsReady={roles.isSuccess && !roles.isFetching}
                    onChange={(value) => {
                      view.save({ filters: { roles: value } })
                    }}
                  />
                </div>
              </TableHead>
              <TableHead scope="col" className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">タグ</span>
                  <FilterMenu
                    iconOnly
                    label="タグ"
                    value={tagFilter}
                    options={[
                      { value: "unset", label: "未設定" },
                      ...(tags.data?.tags ?? []).map((tag) => ({
                        value: tag.id,
                        label: tag.name,
                      })),
                    ]}
                    disabled={tags.isPending || tags.isError}
                    optionsReady={tags.isSuccess && !tags.isFetching}
                    onChange={(value) => {
                      view.save({ filters: { tags: value } })
                    }}
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow
                key={member.id}
                data-state={
                  selected.includes(member.id) ? "selected" : undefined
                }
              >
                <TableCell className="px-4">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    aria-label={`${member.displayName}を選択`}
                    checked={selected.includes(member.id)}
                    disabled={pending}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, member.id]
                          : selected.filter((id) => id !== member.id)
                      )
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-normal">
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      name={member.displayName}
                      image={member.image}
                    />
                    <span className="min-w-0 font-medium break-words">
                      {member.displayName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 text-muted-foreground tabular-nums">
                  {member.studentId}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-normal">
                  <button
                    type="button"
                    className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${member.displayName}のロールを変更`}
                    disabled={pending || roles.isPending || roles.isError}
                    onClick={() =>
                      setEditing({ kind: "role", ids: [member.id] })
                    }
                  >
                    <MemberLabels items={member.roles} />
                  </button>
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-normal">
                  <button
                    type="button"
                    className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${member.displayName}のタグを変更`}
                    disabled={pending || !tags.data || tags.isError}
                    onClick={() =>
                      setEditing({ kind: "tag", ids: [member.id] })
                    }
                  >
                    {tags.isPending ? (
                      <span className="text-muted-foreground">読み込み中…</span>
                    ) : tags.isError ? (
                      <span className="text-muted-foreground">取得失敗</span>
                    ) : (
                      <MemberLabels items={memberTags.get(member.id) ?? []} />
                    )}
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {(roster.isPending || (!roster.isError && !members.length)) && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-muted-foreground"
                >
                  {roster.isPending
                    ? "読み込み中…"
                    : "条件に一致するメンバーはいません。"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {managingTags && (
        <TagManager
          year={year}
          tags={tags.data?.tags ?? []}
          onDirtyChange={setEditorDirty}
          onClose={() => setManagingTags(false)}
        />
      )}
      {editing?.kind === "role" && (
        <MemberRoleEditor
          year={year}
          memberIds={editing.ids}
          roles={roleItems}
          onDirtyChange={setEditorDirty}
          onClose={() => setEditing(null)}
          onApplied={applied}
        />
      )}
      {editing?.kind === "tag" && (
        <MemberTagEditor
          year={year}
          memberIds={editing.ids}
          tags={tags.data?.tags ?? []}
          onDirtyChange={setEditorDirty}
          onClose={() => setEditing(null)}
          onApplied={applied}
        />
      )}
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
          title={`${leaving.length}人の年度への参加を解除しますか`}
          description={
            <>
              {year}
              年度への参加を解除します。ロールや勤務の条件によって解除できない人は、選択したまま残ります。
              <span className="mt-2 block max-h-40 overflow-y-auto">
                {leaving.map((id) => (
                  <span className="block" key={id}>
                    {roster.data?.members.find((member) => member.id === id)
                      ?.displayName ?? id}
                  </span>
                ))}
              </span>
            </>
          }
          confirmLabel="参加解除"
          onCancel={() => setLeaving(null)}
          onConfirm={() => {
            const ids = leaving
            setLeaving(null)
            void leave(ids)
          }}
        />
      )}
    </div>
  )
}
