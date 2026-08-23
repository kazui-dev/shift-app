import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronRight } from "lucide-react"

import type { AdminMember } from "@workspace/shared/auth"
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

import { updateAdminAccessLevel, getAdminMembers } from "@/api/admin"
import { errorMessage } from "@/api/client"
import {
  activateYearMembership,
  assignYearRole,
  deactivateYearMembership,
  getRoster,
  getYearMemberships,
  getYearRoles,
  removeYearRole,
} from "@/api/years"
import { nativeSelectClassName } from "@/components/form-styles"
import { ResponsiveSheet } from "@/components/responsive-overlay"
import { ConfirmDialog } from "@/components/confirm-dialog"

const accessLabels = {
  member: "メンバー",
  leader: "委員会幹部",
  system_admin: "システム管理者",
} as const

function isAccessLevel(value: string): value is AdminMember["accessLevel"] {
  return value === "member" || value === "leader" || value === "system_admin"
}

export function MemberManager({ year }: { year: number }) {
  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: getAdminMembers,
    meta: { persist: false },
  })
  const memberships = useQuery({
    queryKey: ["year-memberships", year],
    queryFn: () => getYearMemberships(year),
  })
  const roster = useQuery({
    queryKey: ["roster", year],
    queryFn: () => getRoster(year),
  })
  const roles = useQuery({
    queryKey: ["year-roles", year],
    queryFn: () => getYearRoles(year),
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (
    members.isPending ||
    memberships.isPending ||
    roster.isPending ||
    roles.isPending
  )
    return null
  if (
    members.isError ||
    memberships.isError ||
    roster.isError ||
    roles.isError
  ) {
    return (
      <p className="text-sm text-destructive">
        メンバーを読み込めませんでした。
      </p>
    )
  }

  const membershipById = new Map(
    memberships.data.memberships.map((item) => [item.member.id, item])
  )
  const rosterById = new Map(roster.data.members.map((item) => [item.id, item]))
  const selected =
    members.data.members.find((member) => member.id === selectedId) ?? null

  return (
    <>
      <div className="border-y">
        <Table className="hidden md:table">
          <TableHeader className="text-xs text-muted-foreground">
            <TableRow>
              <TableHead className="pl-0">メンバー</TableHead>
              <TableHead>{year}年度</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>全体権限</TableHead>
              <TableHead>
                <span className="sr-only">詳細</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data.members.map((member) => {
              const active = membershipById.get(member.id)?.status === "active"
              const memberRoles = rosterById.get(member.id)?.roles ?? []
              return (
                <TableRow
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(member.id)}
                >
                  <TableCell className="py-3 pl-0">
                    <span className="block font-medium">
                      {member.displayName}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {member.studentId}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {active ? "メンバー" : "未参加"}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {memberRoles.map((role) => role.name).join("、") || "—"}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {accessLabels[member.accessLevel]}
                  </TableCell>
                  <TableCell className="py-3 pr-0 text-right">
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <ul className="divide-y md:hidden">
          {members.data.members.map((member) => {
            const active = membershipById.get(member.id)?.status === "active"
            return (
              <li key={member.id}>
                <button
                  type="button"
                  className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
                  onClick={() => setSelectedId(member.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {member.displayName}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {member.studentId} · {active ? "メンバー" : "未参加"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {selected && (
        <MemberDetail
          key={selected.id}
          member={selected}
          year={year}
          active={membershipById.get(selected.id)?.status === "active"}
          assignedRoleIds={
            new Set(
              (rosterById.get(selected.id)?.roles ?? []).map((role) => role.id)
            )
          }
          roles={roles.data.roles}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  )
}

function MemberDetail({
  member,
  year,
  active,
  assignedRoleIds,
  roles,
  onClose,
}: {
  member: AdminMember
  year: number
  active: boolean
  assignedRoleIds: Set<string>
  roles: Array<{ id: string; name: string; color: string }>
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [accessLevel, setAccessLevel] = useState(member.accessLevel)
  const [reason, setReason] = useState("")
  const [confirmStop, setConfirmStop] = useState(false)
  const [pending, setPending] = useState(false)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] }),
      queryClient.invalidateQueries({ queryKey: ["year-memberships", year] }),
      queryClient.invalidateQueries({ queryKey: ["roster", year] }),
      queryClient.invalidateQueries({ queryKey: ["years"] }),
    ])
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true)
    try {
      await action()
      await refresh()
      toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <ResponsiveSheet
      open
      title={member.displayName}
      description={member.studentId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="divide-y">
        <section className="py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{year}年度メンバー</h3>
              <p className="text-xs text-muted-foreground">
                {active ? "参加中" : "未参加"}
              </p>
            </div>
            {active ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmStop(true)}
              >
                停止
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => activateYearMembership(year, member.id),
                    "年度メンバーに追加しました。"
                  )
                }
              >
                追加
              </Button>
            )}
          </div>
          {confirmStop && (
            <ConfirmDialog
              title="年度への参加を停止しますか"
              description={`${member.displayName}を${year}年度のメンバーから外します。`}
              confirmLabel="停止する"
              onCancel={() => setConfirmStop(false)}
              onConfirm={() => {
                setConfirmStop(false)
                void run(
                  () => deactivateYearMembership(year, member.id),
                  "年度参加を停止しました。"
                )
              }}
            />
          )}
        </section>
        <section className="py-5">
          <h3 className="mb-3 font-medium">ロール</h3>
          {active ? (
            <div className="space-y-1">
              {roles.map((role) => {
                const assigned = assignedRoleIds.has(role.id)
                return (
                  <button
                    key={role.id}
                    type="button"
                    disabled={pending}
                    className="flex min-h-11 w-full items-center gap-3 text-left"
                    onClick={() =>
                      void run(
                        () =>
                          assigned
                            ? removeYearRole(role.id, member.id)
                            : assignYearRole(role.id, member.id),
                        assigned
                          ? "ロールを解除しました。"
                          : "ロールを付与しました。"
                      )
                    }
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="flex-1">{role.name}</span>
                    {assigned && <Check className="size-4" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              年度メンバーに追加すると設定できます。
            </p>
          )}
        </section>
        <section className="py-5">
          <h3 className="mb-3 font-medium">全体権限</h3>
          <select
            className={nativeSelectClassName}
            disabled={member.isCurrentUser || pending}
            value={accessLevel}
            onChange={(event) => {
              if (isAccessLevel(event.target.value))
                setAccessLevel(event.target.value)
            }}
          >
            {Object.entries(accessLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {accessLevel !== member.accessLevel && (
            <div className="mt-3 space-y-3">
              <Input
                className="h-11"
                maxLength={240}
                placeholder="変更理由"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button
                className="w-full"
                disabled={!reason.trim() || pending}
                onClick={() =>
                  void run(
                    () =>
                      updateAdminAccessLevel(member.id, {
                        accessLevel,
                        reason,
                      }),
                    "全体権限を更新しました。"
                  )
                }
              >
                変更を保存
              </Button>
            </div>
          )}
          {member.isCurrentUser && (
            <p className="mt-2 text-xs text-muted-foreground">
              自分の全体権限は変更できません。
            </p>
          )}
        </section>
      </div>
    </ResponsiveSheet>
  )
}
