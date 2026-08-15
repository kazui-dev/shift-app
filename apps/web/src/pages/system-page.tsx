import { useMemo, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { AdminPanel } from "@/components/admin-panel"
import { errorMessage } from "@/lib/api"
import {
  assignYearRole,
  activateYearMembership,
  createYear,
  createYearRole,
  deactivateYearMembership,
  getYearMembers,
  getYearMemberships,
  getYearRoles,
  getYears,
  removeYearRole,
  updateYear,
} from "@/lib/shifts-api"

export function SystemPage() {
  const queryClient = useQueryClient()
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? years.data?.years[0]?.year ?? null
  const roles = useQuery({
    queryKey: ["year-roles", year],
    queryFn: () => getYearRoles(year!),
    enabled: year !== null,
  })
  const members = useQuery({
    queryKey: ["year-members", year],
    queryFn: () => getYearMembers(year!),
    enabled: year !== null,
  })
  const memberships = useQuery({
    queryKey: ["year-memberships", year],
    queryFn: () => getYearMemberships(year!),
    enabled: year !== null,
  })
  const currentYear = useMemo(
    () => years.data?.years.find((item) => item.year === year),
    [year, years.data]
  )
  const [yearNumber, setYearNumber] = useState(new Date().getFullYear())
  const [roleName, setRoleName] = useState("")
  const [roleColor, setRoleColor] = useState("#7C3AED")
  const [roleCanManage, setRoleCanManage] = useState(false)
  const [roleId, setRoleId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [participantId, setParticipantId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshYearData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["years"] }),
      queryClient.invalidateQueries({ queryKey: ["year-roles", year] }),
      queryClient.invalidateQueries({ queryKey: ["year-members", year] }),
      queryClient.invalidateQueries({ queryKey: ["year-memberships", year] }),
    ])
  }

  async function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (year === null || !participantId) return
    setPending(true)
    setMessage(null)
    try {
      await activateYearMembership(year, participantId)
      setParticipantId("")
      await refreshYearData()
      setMessage("年度参加者を追加しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function removeParticipant(targetMemberId: string) {
    if (
      year === null ||
      !window.confirm(
        "この年度へのアクセスと実効権限を停止します。過去データとロール割当は保持されます。続けますか？"
      )
    )
      return
    setPending(true)
    setMessage(null)
    try {
      await deactivateYearMembership(year, targetMemberId)
      await refreshYearData()
      setMessage("年度参加を無効化しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await createYear({
        year: yearNumber,
        status: "draft",
      })
      setSelectedYear(yearNumber)
      await refreshYearData()
      setMessage("年度を作成しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function changeStatus(status: "draft" | "active" | "archived") {
    if (year === null) return
    setPending(true)
    setMessage(null)
    try {
      await updateYear(year, { status })
      await refreshYearData()
      setMessage("年度の状態を更新しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (year === null) return
    setPending(true)
    setMessage(null)
    try {
      await createYearRole(year, {
        name: roleName,
        color: roleColor,
        permissions: roleCanManage ? ["shift.manage"] : [],
      })
      setRoleName("")
      setRoleCanManage(false)
      await refreshYearData()
      setMessage("年度ロールを作成しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function addMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!roleId || !memberId) return
    setPending(true)
    setMessage(null)
    try {
      await assignYearRole(roleId, memberId)
      await refreshYearData()
      setMessage("ロールを付与しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function deleteMembership(
    targetRoleId: string,
    targetMemberId: string
  ) {
    setPending(true)
    setMessage(null)
    try {
      await removeYearRole(targetRoleId, targetMemberId)
      await refreshYearData()
      setMessage("ロールを解除しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">管理者専用</p>
        <h1 className="text-xl font-medium">システム設定</h1>
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <h2 className="font-medium">年度と権限</h2>
        <form className="flex gap-2" onSubmit={addYear}>
          <input
            type="number"
            min="2000"
            max="2100"
            className="h-10 rounded-md border bg-background px-3"
            value={yearNumber}
            onChange={(event) => setYearNumber(Number(event.target.value))}
          />
          <Button disabled={pending}>年度を作成</Button>
        </form>

        {years.isPending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {years.data?.years.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year}（{item.status}）
              </option>
            ))}
          </select>
        )}
        {currentYear && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">状態:</span>
            {(["draft", "active", "archived"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={currentYear.status === status ? "default" : "outline"}
                disabled={pending || currentYear.status === status}
                onClick={() => void changeStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        )}

        {year !== null && (
          <>
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <h3 className="font-medium">年度参加者</h3>
                <p className="text-sm text-muted-foreground">
                  新年度には自動追加されません。参加者を明示的に追加してください。
                </p>
              </div>
              <form className="flex gap-2" onSubmit={addParticipant}>
                <select
                  className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2"
                  required
                  value={participantId}
                  onChange={(event) => setParticipantId(event.target.value)}
                >
                  <option value="">追加するメンバー</option>
                  {memberships.data?.memberships
                    .filter((membership) => membership.status !== "active")
                    .map((membership) => (
                      <option
                        key={membership.member.id}
                        value={membership.member.id}
                      >
                        {membership.member.displayName}（
                        {membership.member.studentId}）
                      </option>
                    ))}
                </select>
                <Button disabled={pending}>追加</Button>
              </form>
              <ul className="space-y-2 text-sm">
                {memberships.data?.memberships
                  .filter((membership) => membership.status === "active")
                  .map((membership) => (
                    <li
                      key={membership.member.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {membership.member.displayName}（
                        {membership.member.studentId}）
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          void removeParticipant(membership.member.id)
                        }
                      >
                        無効化
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>

            <form
              className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
              onSubmit={addRole}
            >
              <input
                className="h-10 rounded-md border bg-background px-3"
                placeholder="年度ロール名"
                required
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
              />
              <input
                type="color"
                className="h-10 w-full rounded-md border px-1 sm:w-16"
                value={roleColor}
                onChange={(event) => setRoleColor(event.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roleCanManage}
                  onChange={(event) => setRoleCanManage(event.target.checked)}
                />
                シフト管理
              </label>
              <Button className="sm:col-span-3" disabled={pending}>
                ロールを作成
              </Button>
            </form>

            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={addMembership}
            >
              <select
                className="h-10 rounded-md border bg-background px-2"
                required
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                <option value="">ロール</option>
                {roles.data?.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-2"
                required
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">メンバー</option>
                {members.data?.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
              <Button disabled={pending}>付与</Button>
            </form>

            <ul className="space-y-2 text-sm">
              {members.data?.members
                .filter((member) => member.roles.length > 0)
                .map((member) => (
                  <li key={member.id} className="rounded-md border p-3">
                    <span className="font-medium">{member.displayName}</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {member.roles.map((role) => (
                        <Button
                          key={role.id}
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            void deleteMembership(role.id, member.id)
                          }
                        >
                          {role.name}
                          <X />
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          </>
        )}
        {message && <p className="text-sm">{message}</p>}
      </div>

      <AdminPanel />
    </section>
  )
}
