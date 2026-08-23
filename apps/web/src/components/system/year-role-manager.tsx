import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import { createYearRole, getYearRoles } from "@/api/years"

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

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
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
      toast.success("ロールを作成しました。")
    } catch (error) {
      toast.error(errorMessage(error))
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
          <Input
            className="h-11"
            placeholder="ロール名"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            type="color"
            aria-label="ロールの色"
            className="h-11 p-1 sm:w-16"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
          <Field orientation="horizontal" className="min-h-11 sm:col-span-2">
            <Checkbox
              id="can-manage-shifts"
              checked={canManage}
              onCheckedChange={setCanManage}
            />
            <FieldLabel htmlFor="can-manage-shifts">
              シフト管理を許可
            </FieldLabel>
          </Field>
          <Button className="sm:col-span-2" disabled={pending}>
            作成
          </Button>
        </form>
      )}
      {!roles.isPending && (
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
    </section>
  )
}
