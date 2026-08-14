import { useMemo, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { AdminPanel } from "@/components/admin-panel"
import { errorMessage } from "@/lib/api"
import {
  assignYearRole,
  createYear,
  createYearRole,
  getYearMembers,
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
  const currentYear = useMemo(
    () => years.data?.years.find((item) => item.year === year),
    [year, years.data]
  )
  const [yearNumber, setYearNumber] = useState(new Date().getFullYear())
  const [yearName, setYearName] = useState("")
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [roleName, setRoleName] = useState("")
  const [roleColor, setRoleColor] = useState("#7C3AED")
  const [roleCanManage, setRoleCanManage] = useState(false)
  const [roleId, setRoleId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshYearData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["years"] }),
      queryClient.invalidateQueries({ queryKey: ["year-roles", year] }),
      queryClient.invalidateQueries({ queryKey: ["year-members", year] }),
    ])
  }

  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await createYear({
        year: yearNumber,
        name: yearName,
        startsOn,
        endsOn,
        status: "draft",
      })
      setSelectedYear(yearNumber)
      setYearName("")
      setStartsOn("")
      setEndsOn("")
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
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={addYear}>
          <input
            type="number"
            min="2000"
            max="2100"
            className="h-10 rounded-md border bg-background px-3"
            value={yearNumber}
            onChange={(event) => setYearNumber(Number(event.target.value))}
          />
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="年度名"
            required
            value={yearName}
            onChange={(event) => setYearName(event.target.value)}
          />
          <input
            type="date"
            className="h-10 rounded-md border bg-background px-3"
            required
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
          <input
            type="date"
            className="h-10 rounded-md border bg-background px-3"
            required
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
          <Button className="sm:col-span-2" disabled={pending}>
            年度を作成
          </Button>
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
                {item.name}（{item.status}）
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
