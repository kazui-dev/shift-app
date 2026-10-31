import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { RowSelectionState } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ScrollViewport } from "@workspace/ui/components/scroll-viewport"
import { TableSelectionActions } from "@workspace/ui/components/table-selection-actions"
import { matchesTableSearch } from "@workspace/ui/lib/data-table"
import { toast } from "@workspace/ui/lib/toast"
import { QueryError } from "@/components/query-error"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import type {
  ManagementScreenView,
  ManagementTableView,
} from "@/features/management/management-context"
import { tagsQuery } from "../data/tags"
import { emptyFilter, matchesFilter } from "@workspace/ui/lib/filters"
import { rosterQuery } from "@/features/years/data/years"
import { changeMemberRoles, type getRoster } from "@/features/years/api/years"
import { keys } from "@/app/data/keys"
import { errorMessage } from "@/lib/http/client"
import { changeMemberTags } from "../api/tags"
import { MemberSelectionTable } from "./member-selection-table"

type Member = Awaited<ReturnType<typeof getRoster>>["members"][number]
export function LabelMembersManager({
  year,
  kind,
  id,
  name,
  memberIds,
  canEdit,
  canEditMember,
  canReadTags,
  view,
  onStatusChange,
}: {
  year: number
  kind: "role" | "tag"
  id: string
  name: string
  memberIds: string[]
  canReadTags: boolean
  canEdit: boolean
  canEditMember: (member: Member) => boolean
  view: ManagementTableView
  onStatusChange: (status: { dirty: boolean; pending: boolean }) => void
}) {
  const query = useQuery(rosterQuery(year))
  const tags = useQuery({ ...tagsQuery(year), enabled: canReadTags })
  const client = useQueryClient()
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [adding, setAdding] = useState(false)
  const [addSelection, setAddSelection] = useState<RowSelectionState>({})
  const [addView, setAddView] = useState<ManagementScreenView>({
    search: "",
    scrollTop: 0,
  })
  const [removing, setRemoving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [pending, setPending] = useState(false)
  const members = (query.data?.members ?? []).map((member) => ({
    ...member,
    tags: (tags.data?.tags ?? []).filter((tag) =>
      tag.memberIds.includes(member.id)
    ),
  }))
  const roleOptions = [
    ...new Map(
      members.flatMap((member) => member.roles).map((role) => [role.id, role])
    ).values(),
  ]
  const tableOptions = {
    rolesReady: query.isSuccess && !query.isFetching,
    tagsReady: canReadTags && tags.isSuccess && !tags.isFetching,
    roles: roleOptions,
    tags: tags.data?.tags ?? [],
    tagsLoading: canReadTags && tags.isPending,
    tagsError: tags.isError,
    tagsUnavailable: !canReadTags,
  }
  const hidden = (
    items: typeof members,
    conditions: Pick<ManagementTableView, "search" | "textFilters" | "filters">
  ) =>
    items.filter(
      (member) =>
        !matchesTableSearch(member.displayName, conditions.search) ||
        !matchesTableSearch(
          member.studentId,
          conditions.textFilters?.studentId ?? ""
        ) ||
        !matchesFilter(
          member.roles.map((role) => role.id),
          conditions.filters?.roles ?? emptyFilter()
        ) ||
        (canReadTags &&
          tags.isSuccess &&
          !matchesFilter(
            member.tags.map((tag) => tag.id),
            conditions.filters?.tags ?? emptyFilter()
          ))
    ).length
  const assigned = members.filter((member) => memberIds.includes(member.id))
  const candidates = members.filter((member) => !memberIds.includes(member.id))
  const selected = assigned.filter(
    (member) => selection[member.id] && canEditMember(member)
  )
  const additions = candidates.filter(
    (member) => addSelection[member.id] && canEditMember(member)
  )
  const dirty = adding && additions.length > 0
  useEffect(() => {
    onStatusChange({ dirty, pending })
    return () => onStatusChange({ dirty: false, pending: false })
  }, [dirty, pending, onStatusChange])
  function closeAdd() {
    if (pending) return
    if (dirty) setDiscarding(true)
    else setAdding(false)
  }
  async function apply(add: boolean) {
    const ids = (add ? additions : selected).map((member) => member.id)
    if (!canEdit || pending || !ids.length) return
    setPending(true)
    setRemoving(false)
    try {
      if (kind === "role")
        await changeMemberRoles(year, {
          memberIds: ids,
          addRoleIds: add ? [id] : [],
          removeRoleIds: add ? [] : [id],
        })
      else
        await changeMemberTags(year, {
          memberIds: ids,
          addTagIds: add ? [id] : [],
          removeTagIds: add ? [] : [id],
        })
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.roster(year) }),
        client.invalidateQueries({ queryKey: keys.yearRoles(year) }),
        client.invalidateQueries({ queryKey: keys.yearTags(year) }),
        client.invalidateQueries({ queryKey: keys.years() }),
      ])
      if (add) {
        setAdding(false)
        setAddSelection({})
      } else setSelection({})
      toast.success(add ? "メンバーを追加しました。" : "メンバーを外しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <ManagementHeaderActions>
        <Button
          size="sm"
          disabled={!canEdit || pending || !query.isSuccess}
          onClick={() => {
            setAddSelection({})
            setAddView({ search: "", scrollTop: 0 })
            setAdding(true)
          }}
        >
          <Plus />
          メンバーを追加
        </Button>
      </ManagementHeaderActions>
      <ManagementHeaderActions placement="start">
        <TableSelectionActions
          count={selected.length}
          hiddenCount={hidden(selected, view)}
          disabled={pending}
          onClear={() => setSelection({})}
        >
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit || pending}
            onClick={() => setRemoving(true)}
          >
            {kind === "role" ? "ロール" : "タグ"}から外す
          </Button>
        </TableSelectionActions>
      </ManagementHeaderActions>
      {query.isError && (
        <QueryError
          message="メンバーを取得できませんでした。"
          onRetry={() => query.refetch()}
        />
      )}
      <MemberSelectionTable
        {...tableOptions}
        members={assigned}
        selection={selection}
        onSelectionChange={setSelection}
        canSelect={(member) => canEdit && !pending && canEditMember(member)}
        view={view}
        label={`${name}のメンバー`}
        empty={
          query.isSuccess
            ? assigned.length
              ? "条件に一致するメンバーはいません。"
              : "メンバーがいません。"
            : ""
        }
      />
      {adding && (
        <ResponsiveDialog
          open
          title={`${name}にメンバーを追加`}
          onOpenChange={(open) => {
            if (!open) closeAdd()
          }}
          className="sm:max-w-3xl"
          bodyClassName="overflow-hidden p-0"
        >
          <div className="flex h-[60dvh] min-h-0 flex-col">
            <ScrollViewport>
              <MemberSelectionTable
                {...tableOptions}
                members={candidates}
                selection={addSelection}
                onSelectionChange={setAddSelection}
                canSelect={(member) => !pending && canEditMember(member)}
                view={{
                  ...addView,
                  save: (patch) =>
                    setAddView((current) => ({ ...current, ...patch })),
                }}
                label="追加するメンバー"
                empty="追加できるメンバーがいません。"
              />
            </ScrollViewport>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
              <TableSelectionActions
                count={additions.length}
                hiddenCount={hidden(additions, addView)}
                disabled={pending}
                onClear={() => setAddSelection({})}
              />
              <div className="ml-auto flex gap-2">
                <Button variant="outline" disabled={pending} onClick={closeAdd}>
                  キャンセル
                </Button>
                <Button
                  disabled={pending || additions.length === 0}
                  onClick={() => void apply(true)}
                >
                  {pending ? "追加中…" : "追加"}
                </Button>
              </div>
            </div>
          </div>
        </ResponsiveDialog>
      )}
      {removing && (
        <ConfirmDialog
          title={`${selected.length}人を「${name}」から外しますか`}
          description={selected.map((member) => member.displayName).join("、")}
          confirmLabel="外す"
          onCancel={() => setRemoving(false)}
          onConfirm={() => void apply(false)}
        />
      )}
      {discarding && (
        <ConfirmDialog
          title="選択を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setDiscarding(false)}
          onConfirm={() => {
            setDiscarding(false)
            setAdding(false)
            setAddSelection({})
          }}
        />
      )}
    </>
  )
}
