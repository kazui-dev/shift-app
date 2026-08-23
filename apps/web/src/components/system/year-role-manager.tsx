import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import { createYearRole, getYearRoles } from "@/api/years"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"
import { LoadingState } from "@/components/page-layout"

export function YearRoleManager({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const roles = useQuery({
    queryKey: ["year-roles", year],
    queryFn: () => getYearRoles(year),
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [color, setColor] = useState("#7C3AED")
  const [canManage, setCanManage] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await createYearRole(year, {
        name,
        color,
        permissions: canManage ? ["shift.manage"] : [],
      })
      setName("")
      setCanManage(false)
      setCreateOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["year-roles", year] }),
        queryClient.invalidateQueries({ queryKey: ["years"] }),
      ])
      setMessage("ロールを作成しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
          <Plus />
          ロールを追加
        </Button>
      </div>
      {createOpen && (
        <form
          className="grid gap-3 border-y py-4 sm:grid-cols-[1fr_auto]"
          onSubmit={addRole}
        >
          <div className="flex items-center justify-between sm:col-span-2">
            <h2 className="font-medium">新しいロール</h2>
            <Button
              size="icon-sm"
              variant="ghost"
              type="button"
              aria-label="閉じる"
              onClick={() => setCreateOpen(false)}
            >
              <X />
            </Button>
          </div>
          <input
            className={fieldClassName}
            placeholder="ロール名"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            type="color"
            aria-label="ロールの色"
            className={`${fieldClassName} p-1 sm:w-16`}
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={canManage}
              onChange={(event) => setCanManage(event.target.checked)}
            />
            シフト管理を許可
          </label>
          <Button className="sm:col-span-2" disabled={pending}>
            作成
          </Button>
        </form>
      )}
      {roles.isPending ? (
        <LoadingState />
      ) : (
        <ul className="divide-y border-y">
          {roles.data?.roles.map((role) => (
            <li key={role.id} className="flex min-h-14 items-center gap-3 py-3">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              <span className="min-w-0 flex-1 font-medium">{role.name}</span>
              <span className="text-xs text-muted-foreground">
                {role.memberCount}人
                {role.permissions.includes("shift.manage")
                  ? " · シフト管理"
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </section>
  )
}
