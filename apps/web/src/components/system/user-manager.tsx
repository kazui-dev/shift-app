import { MemberAvatar } from "@/components/member-avatar"
import { keys } from "@/data/keys"
import { usersQuery } from "@/data/admin"
import { yearsQuery } from "@/data/years"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { AdminUser } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { updateAdminAccessLevel } from "@/api/admin"
import { activateYearMembership, deactivateYearMembership } from "@/api/years"
import { errorMessage } from "@/api/client"
import { ResponsiveSheet } from "@/components/responsive-overlay"
import { SelectField } from "@/components/select-field"

const labels = {
  member: "一般",
  leader: "委員会幹部",
  system_admin: "システム管理者",
}
export function UserManager() {
  const users = useQuery({
    ...usersQuery,
  })
  const years = useQuery({ ...yearsQuery })
  const [search, setSearch] = useState("")
  const [id, setId] = useState<string | null>(null)
  const selected = users.data?.users.find((user) => user.id === id)
  return (
    <div className="space-y-4">
      <Input
        placeholder="名前・学籍番号で検索"
        aria-label="ユーザーを検索"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ul className="divide-y border-y">
        {users.data?.users
          .filter((user) =>
            `${user.displayName} ${user.studentId}`
              .toLowerCase()
              .includes(search.toLowerCase())
          )
          .map((user) => (
            <li key={user.id}>
              <button
                className="flex min-h-16 w-full items-center gap-4 py-3 text-left"
                aria-label={`${user.displayName}の詳細`}
                onClick={() => setId(user.id)}
              >
                <MemberAvatar name={user.displayName} image={user.image} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{user.displayName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {user.studentId}
                  </span>
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  <span className="block">
                    {user.years.join("・") || "未参加"}
                  </span>
                  <span className="text-xs">{labels[user.accessLevel]}</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
      {selected && (
        <UserDetail
          key={selected.id}
          user={selected}
          years={years.data?.years.map((year) => year.year) ?? []}
          onClose={() => setId(null)}
        />
      )}
    </div>
  )
}
function UserDetail({
  user,
  years,
  onClose,
}: {
  user: AdminUser
  years: number[]
  onClose: () => void
}) {
  const client = useQueryClient()
  const [level, setLevel] = useState(user.accessLevel)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<unknown>) {
    setPending(true)
    try {
      await action()
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.adminUsers() }),
        client.invalidateQueries({ queryKey: keys.yearMemberships() }),
        client.invalidateQueries({ queryKey: keys.roster() }),
        client.invalidateQueries({ queryKey: keys.displayYear() }),
      ])
      toast.success("保存しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <ResponsiveSheet
      open
      title={user.displayName}
      description={user.studentId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-7">
        <section>
          <h3 className="mb-3 text-sm font-medium">参加年度</h3>
          <div className="divide-y">
            {years.map((year) => (
              <label
                key={year}
                className="flex min-h-11 items-center justify-between text-sm"
              >
                {year}
                <input
                  type="checkbox"
                  checked={user.years.includes(year)}
                  disabled={pending}
                  onChange={(event) =>
                    void run(() =>
                      event.target.checked
                        ? activateYearMembership(year, user.id)
                        : deactivateYearMembership(year, user.id)
                    )
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <label htmlFor="user-access" className="block text-sm font-medium">
            システム権限
          </label>
          <SelectField
            id="user-access"
            value={level}
            disabled={user.isCurrentUser || pending}
            onValueChange={(value) => {
              if (
                value === "member" ||
                value === "leader" ||
                value === "system_admin"
              )
                setLevel(value)
            }}
            options={Object.entries(labels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          {level !== user.accessLevel && (
            <>
              <Input
                aria-label="変更理由"
                placeholder="変更理由"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button
                disabled={pending || !reason.trim()}
                onClick={() =>
                  void run(() =>
                    updateAdminAccessLevel(user.id, {
                      accessLevel: level,
                      reason,
                    })
                  )
                }
              >
                保存
              </Button>
            </>
          )}
        </section>
        <p className="text-sm text-muted-foreground">
          Discord：{user.discordLinked ? "連携済み" : "未連携"}
        </p>
      </div>
    </ResponsiveSheet>
  )
}
