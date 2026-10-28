import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { AttendanceSettings } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { LoadingState } from "@/app/page-layout"
import { keys } from "@/app/data/keys"
import { rolesQuery, rosterQuery } from "@/features/years/data/years"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import { errorMessage } from "@/lib/http/client"
import { getAttendanceSettings, saveAttendanceSettings } from "../api/settings"
import { NoticeTargets } from "./notice-targets"
import { SelectField } from "@/components/select-field"

export function AttendanceSettingsPanel({
  year,
  onDirtyChange,
}: {
  year: number
  onDirtyChange: (dirty: boolean) => void
}) {
  const settings = useQuery({
    queryKey: keys.attendanceSettings(year),
    queryFn: () => getAttendanceSettings(year),
  })
  const roles = useQuery(rolesQuery(year)),
    roster = useQuery(rosterQuery(year))
  if (settings.isPending || roles.isPending || roster.isPending)
    return <LoadingState />
  if (settings.isError || roles.isError || roster.isError)
    return (
      <div role="alert" className="space-y-3">
        <p>勤怠設定を読み込めませんでした。</p>
        <Button
          variant="outline"
          onClick={() => {
            void settings.refetch()
            void roles.refetch()
            void roster.refetch()
          }}
        >
          再読み込み
        </Button>
      </div>
    )
  return (
    <SettingsForm
      key={year}
      year={year}
      initial={settings.data}
      roles={roles.data.roles}
      members={roster.data.members}
      onDirtyChange={onDirtyChange}
    />
  )
}
function SettingsForm({
  year,
  initial,
  roles,
  members,
  onDirtyChange,
}: {
  year: number
  initial: AttendanceSettings
  roles: { id: string; name: string }[]
  members: { id: string; displayName: string; studentId: string }[]
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<AttendanceSettings | null>(null),
    [pending, setPending] = useState(false)
  const value = draft ?? initial
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(initial)
  useEffect(() => {
    onDirtyChange(dirty || pending)
    return () => onDirtyChange(false)
  }, [dirty, pending, onDirtyChange])
  async function save() {
    setPending(true)
    try {
      await saveAttendanceSettings(year, value)
      client.setQueryData(keys.attendanceSettings(year), value)
      setDraft(null)
      await client.invalidateQueries({ queryKey: keys.chatRooms() })
      toast.success("勤怠設定を保存しました。")
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
          disabled={!dirty || pending}
          onClick={() => void save()}
        >
          {pending ? "保存中…" : "保存"}
        </Button>
      </ManagementHeaderActions>
      <section className="max-w-4xl space-y-6" aria-label="勤怠通知の閲覧設定">
        <h3 className="text-sm font-semibold">勤怠通知</h3>
        <fieldset disabled={pending} className="space-y-6">
          <div className="grid items-center gap-3 sm:grid-cols-[8rem_minmax(0,22rem)]">
            <label htmlFor="notice-audience" className="text-sm">
              閲覧範囲
            </label>
            <SelectField
              id="notice-audience"
              aria-label="閲覧範囲"
              size="default"
              value={value.noticeAudience}
              options={[
                { value: "room_members", label: "チャット参加者全員" },
                { value: "selected", label: "指定したロール・メンバー" },
              ]}
              onValueChange={(noticeAudience) => {
                if (
                  noticeAudience === "selected" ||
                  noticeAudience === "room_members"
                )
                  setDraft({ ...value, noticeAudience })
              }}
            />
          </div>
          {value.noticeAudience === "selected" && (
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <NoticeTargets
                label="ロール"
                options={roles}
                value={value.roleIds}
                onChange={(roleIds) => setDraft({ ...value, roleIds })}
              />
              <NoticeTargets
                label="メンバー"
                options={members.map((member) => ({
                  id: member.id,
                  name: member.displayName,
                  detail: member.studentId,
                }))}
                value={value.memberIds}
                onChange={(memberIds) => setDraft({ ...value, memberIds })}
              />
            </div>
          )}
        </fieldset>
      </section>
    </>
  )
}
