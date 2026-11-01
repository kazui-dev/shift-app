import * as v from "valibot"
import { ViewSwitch } from "@workspace/ui/components/view-switch"
import { useViewPreference } from "@/lib/view-preferences"
import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { RowSelectionState } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { TableSelectionActions } from "@workspace/ui/components/table-selection-actions"
import { matchesTableSearch } from "@workspace/ui/lib/data-table"
import { toast } from "@workspace/ui/lib/toast"
import { QueryError } from "@/components/query-error"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import type { ManagementTableView } from "@/features/management/management-context"
import { tagsQuery } from "../data/tags"
import { emptyFilter, matchesFilter } from "@workspace/ui/lib/filters"
import { rosterQuery } from "@/features/years/data/years"
import { changeMemberRoles, type getRoster } from "@/features/years/api/years"
import { keys } from "@/app/data/keys"
import { errorMessage } from "@/lib/http/client"
import { changeMemberTags } from "../api/tags"
import { MemberSelectionTable } from "./member-selection-table"

const membershipSchema = v.picklist(["assigned", "unassigned"])

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
  const [mode, setMode] = useViewPreference(
    `label-members:${kind}:${year}:${id}:mode`,
    membershipSchema,
    "assigned"
  )
  const [removing, setRemoving] = useState(false)
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
    conditions: Pick<ManagementTableView, "search" | "filters">
  ) =>
    items.filter(
      (member) =>
        (!matchesTableSearch(member.displayName, conditions.search) &&
          !matchesTableSearch(member.studentId, conditions.search)) ||
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
  const visibleMembers = members.filter((member) =>
    mode === "assigned"
      ? memberIds.includes(member.id)
      : !memberIds.includes(member.id)
  )
  const selected = visibleMembers.filter(
    (member) => selection[member.id] && canEditMember(member)
  )
  useEffect(() => {
    onStatusChange({ dirty: false, pending })
    return () => onStatusChange({ dirty: false, pending: false })
  }, [pending, onStatusChange])
  async function apply(add: boolean) {
    const ids = selected.map((member) => member.id)
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
      setSelection({})
      toast.success(add ? "付与しました。" : "解除しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <ManagementHeaderActions placement="start">
        <ViewSwitch
          label="付与状態"
          options={[
            { id: "assigned", label: "付与済み" },
            { id: "unassigned", label: "未付与" },
          ]}
          value={mode}
          disabled={pending}
          onChange={(next) => {
            setSelection({})
            setRemoving(false)
            setMode(next)
          }}
        />
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
            onClick={() => {
              if (mode === "assigned") setRemoving(true)
              else void apply(true)
            }}
          >
            {kind === "role" ? "ロール" : "タグ"}を
            {mode === "assigned" ? "解除" : "付与"}
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
        members={visibleMembers}
        selection={selection}
        onSelectionChange={setSelection}
        canSelect={(member) => canEdit && !pending && canEditMember(member)}
        view={view}
        label={`${name}の${mode === "assigned" ? "付与済み" : "未付与"}メンバー`}
        empty={
          query.isSuccess
            ? visibleMembers.length
              ? "条件に一致するメンバーはいません。"
              : "メンバーがいません。"
            : ""
        }
      />
      {removing && (
        <ConfirmDialog
          title={`${selected.length}人の「${name}」を解除しますか`}
          description={selected.map((member) => member.displayName).join("、")}
          confirmLabel="解除"
          onCancel={() => setRemoving(false)}
          onConfirm={() => void apply(false)}
        />
      )}
    </>
  )
}
