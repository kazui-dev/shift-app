import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import {
  assignYearRole,
  createYearRole,
  getRoster,
  getYearRoles,
  removeYearRole,
} from "@/api/years"

export function YearRoleManager({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const roles = useQuery({
    queryKey: ["year-roles", year],
    queryFn: () => getYearRoles(year),
  })
  const members = useQuery({
    queryKey: ["roster", year],
    queryFn: () => getRoster(year),
  })
  const [roleName, setRoleName] = useState("")
  const [roleColor, setRoleColor] = useState("#7C3AED")
  const [roleCanManage, setRoleCanManage] = useState(false)
  const [roleId, setRoleId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshRoles() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["year-roles", year] }),
      queryClient.invalidateQueries({ queryKey: ["roster", year] }),
      queryClient.invalidateQueries({ queryKey: ["years"] }),
    ])
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      await refreshRoles()
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
      await refreshRoles()
      setMessage("ロールを付与しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function deleteMembership(role: string, member: string) {
    setPending(true)
    setMessage(null)
    try {
      await removeYearRole(role, member)
      await refreshRoles()
      setMessage("ロールを解除しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
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
                    onClick={() => void deleteMembership(role.id, member.id)}
                  >
                    {role.name}
                    <X />
                  </Button>
                ))}
              </div>
            </li>
          ))}
      </ul>
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}
