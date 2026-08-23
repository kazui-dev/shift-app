import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronRight, X } from "lucide-react"

import type { AdminMember } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

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
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"
import { LoadingState } from "@/components/page-layout"

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
    return <LoadingState />
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
      <div className="overflow-x-auto border-y">
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="py-3 font-medium">メンバー</th>
              <th className="py-3 font-medium">{year}年度</th>
              <th className="py-3 font-medium">ロール</th>
              <th className="py-3 font-medium">全体権限</th>
              <th>
                <span className="sr-only">詳細</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.data.members.map((member) => {
              const active = membershipById.get(member.id)?.status === "active"
              const memberRoles = rosterById.get(member.id)?.roles ?? []
              return (
                <tr
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(member.id)}
                >
                  <td className="py-3">
                    <span className="block font-medium">
                      {member.displayName}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {member.studentId}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {active ? "メンバー" : "未参加"}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {memberRoles.map((role) => role.name).join("、") || "—"}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {accessLabels[member.accessLevel]}
                  </td>
                  <td className="py-3 text-right">
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
  const [message, setMessage] = useState<string | null>(null)

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
    setMessage(null)
    try {
      await action()
      await refresh()
      setMessage(success)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="閉じる"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-background px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:inset-y-0 md:right-0 md:left-auto md:w-[28rem] md:rounded-none md:border-l md:p-6">
        <header className="flex items-start justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="font-semibold">{member.displayName}</h2>
            <p className="font-mono text-xs text-muted-foreground">
              {member.studentId}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="閉じる"
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
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
              <div className="mt-4 border-l-2 border-destructive pl-3 text-sm">
                <p>年度への参加を停止しますか？</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmStop(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      setConfirmStop(false)
                      void run(
                        () => deactivateYearMembership(year, member.id),
                        "年度参加を停止しました。"
                      )
                    }}
                  >
                    停止する
                  </Button>
                </div>
              </div>
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
              className={fieldClassName}
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
                <input
                  className={fieldClassName}
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
        {message && (
          <FeedbackNotice
            message={message}
            onDismiss={() => setMessage(null)}
          />
        )}
      </section>
    </div>
  )
}
