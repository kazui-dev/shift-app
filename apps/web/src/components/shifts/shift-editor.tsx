import { mergePlan } from "./merge-plan"
import { ShiftConflicts } from "./shift-conflicts"
import { ShiftAttendance } from "./shift-attendance"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import { Settings2, MoreHorizontal, ArrowLeft } from "lucide-react"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  getActivity,
  saveActivity,
  copyActivity,
  deleteActivity,
  notifyActivity,
} from "@/api/activities"
import { ApiError, errorMessage } from "@/api/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { nativeSelectClassName } from "@/components/form-styles"
import { japanDateTime, japanLocalDateTime } from "@/lib/japan-time"
import { change, undo, redo, type EditHistory } from "./editor-history"
import { TimeGrid, type EditorData } from "./time-grid"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

function local(value: string) {
  const date = japanDateTime(value)
  return `${date.date}T${String(date.hour).padStart(2, "0")}:${String(date.minute).padStart(2, "0")}`
}
function initial(data: EditorData): ActivityEditorInput {
  return {
    ...data.activity,
    slots: data.slots,
    candidateRoleIds: data.candidateRoleIds,
    responsibles: data.responsibles,
  }
}
export function ShiftEditor({ data: source }: { data: EditorData }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [actions, setActions] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [includeUnavailable, setIncludeUnavailable] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copyDate, setCopyDate] = useState("")
  const [history, setHistory] = useState<EditHistory<ActivityEditorInput>>(
    () => ({ past: [], present: initial(source), future: [] })
  )
  const [saved, setSaved] = useState(() => JSON.stringify(initial(source)))
  const [base, setBase] = useState(() => initial(source))
  const [latest, setLatest] = useState<EditorData | null>(null)
  const [conflicted, setConflicted] = useState(false)
  const [version, setVersion] = useState(source.activity.version)
  const [selection, setSelection] = useState<ShiftSelection | null>(null)
  const [role, setRole] = useState(
    source.candidateRoleIds.length === 1
      ? (source.candidateRoleIds[0] ?? "")
      : source.candidateRoleIds.length > 1
        ? "candidates"
        : ""
  )
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [pending, setPending] = useState(false)
  const [warning, setWarning] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const plan = history.present,
    dirty = JSON.stringify(plan) !== saved
  const data = {
    ...source,
    availability: source.availability.filter(
      (window) =>
        Date.parse(window.startsAt) < Date.parse(plan.endsAt) &&
        Date.parse(window.endsAt) > Date.parse(plan.startsAt)
    ),
  }
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  })
  function update(value: ActivityEditorInput) {
    setHistory((current) => change(current, value))
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        pending ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "z"
      )
        return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest("input,textarea,select") || target.isContentEditable)
      )
        return
      event.preventDefault()
      setHistory((current) => (event.shiftKey ? redo(current) : undo(current)))
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [pending])
  function applySelection(value: ShiftSelection): string | null {
    const start = Date.parse(value.startsAt),
      end = Date.parse(value.endsAt)
    if (start < Date.parse(plan.startsAt) || end > Date.parse(plan.endsAt))
      return "シフトの開始・終了の範囲内で指定してください。"
    if (
      data.otherAssignments.some(
        (item) =>
          item.memberId === value.memberId &&
          Date.parse(item.startsAt) < end &&
          Date.parse(item.endsAt) > start
      ) ||
      plan.slots.some(
        (slot) =>
          slot.id !== value.slotId &&
          slot.memberIds.includes(value.memberId) &&
          Date.parse(slot.startsAt) < end &&
          Date.parse(slot.endsAt) > start
      )
    )
      return "この時間には別のシフトがあります。"
    const original = plan.slots.find((slot) => slot.id === value.slotId)
    const destination = plan.slots.find(
      (slot) => slot.startsAt === value.startsAt && slot.endsAt === value.endsAt
    )
    const id =
      destination?.id ??
      (original?.memberIds.length === 1 ? original.id : crypto.randomUUID())
    const slots = plan.slots
      .map((slot) => ({
        ...slot,
        memberIds:
          slot.id === value.slotId
            ? slot.memberIds.filter((member) => member !== value.memberId)
            : slot.memberIds,
      }))
      .filter((slot) => slot.id !== id)
    slots.push({
      id,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      capacity: destination?.capacity ?? original?.capacity ?? null,
      memberIds: [
        ...new Set([
          ...(destination?.memberIds ?? []).filter(
            (member) => member !== value.memberId
          ),
          value.memberId,
        ]),
      ],
    })
    update({
      ...plan,
      slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    })
    setSelection({ ...value, slotId: id })
    return null
  }
  async function save(confirmed = false) {
    const outside = plan.slots.some((slot) =>
      slot.memberIds.some(
        (memberId) =>
          !data.availability.some(
            (window) =>
              window.memberId === memberId &&
              Date.parse(window.startsAt) <= Date.parse(slot.startsAt) &&
              Date.parse(window.endsAt) >= Date.parse(slot.endsAt)
          )
      )
    )
    if (outside && !confirmed) {
      setWarning(true)
      return
    }
    setPending(true)
    setFailure(null)
    try {
      const result = await saveActivity(data.activity.id, { ...plan, version })
      client.setQueryData(["activity-editor", data.activity.id], result)
      setVersion(result.activity.version)
      setSaved(JSON.stringify(plan))
      setBase({ ...plan, version: result.activity.version })
      setConflicted(false)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["activities", data.activity.year],
        }),
        client.invalidateQueries({ queryKey: ["assignments"] }),
      ])
      toast.success("保存しました。")
    } catch (error) {
      setFailure(errorMessage(error))
      setConflicted(error instanceof ApiError && error.code === "SHIFT_CHANGED")
    } finally {
      setPending(false)
    }
  }
  async function action(work: () => Promise<unknown>) {
    setPending(true)
    try {
      await work()
      await client.invalidateQueries({
        queryKey: ["activities", data.activity.year],
      })
      setActions(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="flex h-[calc(100dvh-6.75rem-env(safe-area-inset-bottom))] min-h-0 min-w-0 flex-col gap-4 md:h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/manage/shifts"
          aria-label="シフト一覧へ戻る"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-lg font-semibold">
          <span className="whitespace-nowrap">
            {new Intl.DateTimeFormat("ja-JP", {
              month: "long",
              day: "numeric",
              weekday: "short",
              timeZone: "Asia/Tokyo",
            }).format(new Date(plan.startsAt))}
          </span>
          <span className="truncate">{plan.name}</span>
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="シフトの操作"
          disabled={pending}
          onClick={() => setActions(true)}
        >
          <MoreHorizontal />
        </Button>
        <Button
          size="sm"
          disabled={pending || !dirty}
          onClick={() => void save()}
        >
          保存
        </Button>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <fieldset
          disabled={pending}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:pr-4"
        >
          <div className="flex flex-wrap items-center gap-2 pl-38 sm:pl-46">
            <div className="mr-auto flex w-full items-center gap-4 text-xs text-muted-foreground sm:w-auto">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-[22px] rounded-[3px] bg-[#e7edf3] dark:bg-slate-800" />
                希望時間
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-[22px] rounded-[3px]"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${plan.color} 22%, var(--background))`,
                  }}
                />
                シフト
              </span>
            </div>
          </div>
          <TimeGrid
            data={data}
            plan={plan}
            role={role}
            search={search}
            includeUnavailable={includeUnavailable}
            selection={selection}
            onSelect={setSelection}
            onCommit={(value) => {
              const error = applySelection(value)
              if (error) toast.error(error)
            }}
            onMember={(memberId) =>
              setSelection({
                memberId,
                slotId: null,
                startsAt: plan.startsAt,
                endsAt: plan.endsAt,
              })
            }
            onFilter={() => setFiltersOpen(true)}
          />
        </fieldset>
        {selection && (
          <ShiftSelectionPanel
            key={selection.memberId}
            selection={selection}
            slots={plan.slots}
            startsAt={plan.startsAt}
            endsAt={plan.endsAt}
            data={data}
            pending={pending}
            onClose={() => setSelection(null)}
            onApply={applySelection}
            onRemove={(slotId) => {
              update({
                ...plan,
                slots: plan.slots.map((slot) =>
                  slot.id === slotId
                    ? {
                        ...slot,
                        memberIds: slot.memberIds.filter(
                          (id) => id !== selection.memberId
                        ),
                      }
                    : slot
                ),
              })
            }}
          />
        )}
      </div>
      {filtersOpen && (
        <ResponsiveDialog
          open
          title="メンバーを絞り込む"
          onOpenChange={setFiltersOpen}
        >
          <div className="space-y-4">
            <label htmlFor="member-search" className="block space-y-2 text-sm">
              名前・学番
              <Input
                id="member-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm">
              ロール
              <select
                className={nativeSelectClassName}
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="">すべて</option>
                {plan.candidateRoleIds.length > 1 && (
                  <option value="candidates">シフトに設定したロール</option>
                )}
                {data.roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeUnavailable}
                onChange={(event) =>
                  setIncludeUnavailable(event.target.checked)
                }
              />
              参加不可・未回答のメンバーも表示
            </label>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setRole("")
                  setSearch("")
                  setIncludeUnavailable(true)
                }}
              >
                解除
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>表示する</Button>
            </div>
          </div>
        </ResponsiveDialog>
      )}
      {actions && (
        <ResponsiveDialog
          open
          title="シフトの操作"
          onOpenChange={(open) => {
            if (!open) setActions(false)
          }}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActions(false)
                  setSettings(true)
                }}
              >
                <Settings2 />
                シフトの設定
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setActions(false)
                  setAttendanceOpen(true)
                }}
              >
                出勤・連絡
              </Button>
            </div>
            <Button
              variant="outline"
              disabled={pending || dirty || !plan.active}
              onClick={() =>
                void action(async () => {
                  await notifyActivity(data.activity.id)
                  toast.success("更新を通知しました。")
                })
              }
            >
              更新を通知する
            </Button>
            {dirty && (
              <p className="text-xs text-muted-foreground">
                通知・複製の前に変更を保存してください。
              </p>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void action(async () => {
                  const copy = await copyActivity(data.activity.id, copyDate)
                  await navigate({
                    to: "/manage/shifts/$shiftId",
                    params: { shiftId: copy.id },
                  })
                })
              }}
            >
              <Input
                type="date"
                aria-label="複製先の日付"
                required
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
              />
              <Button disabled={pending || dirty || !copyDate}>複製</Button>
            </form>
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={pending || dirty}
              onClick={() => {
                setActions(false)
                setDeleting(true)
              }}
            >
              シフトを削除
            </Button>
          </div>
        </ResponsiveDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title="シフトを削除しますか"
          description="勤務時間・出勤・連絡・チャットも削除されます。この操作は元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false)
            void action(async () => {
              await deleteActivity(data.activity.id)
              await navigate({ to: "/manage/shifts" })
            })
          }}
        />
      )}
      {failure && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {failure} 編集内容は保持しています。
          </p>
          {conflicted && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                void action(async () =>
                  setLatest(await getActivity(data.activity.id))
                )
              }
            >
              最新の変更を確認
            </Button>
          )}
        </div>
      )}
      {latest && (
        <ShiftConflicts
          base={base}
          data={latest}
          local={plan}
          latest={initial(latest)}
          onClose={() => setLatest(null)}
          onMerge={(merged) => {
            client.setQueryData(["activity-editor", data.activity.id], latest)
            setVersion(latest.activity.version)
            setBase(initial(latest))
            setSaved(JSON.stringify(initial(latest)))
            setHistory((current) => ({
              past: current.past.map(
                (item) => mergePlan(base, item, initial(latest)).plan
              ),
              present: merged,
              future: current.future.map(
                (item) => mergePlan(base, item, initial(latest)).plan
              ),
            }))
            setLatest(null)
            setFailure(null)
            setConflicted(false)
          }}
        />
      )}
      {attendanceOpen && (
        <ShiftAttendance
          activityId={data.activity.id}
          onClose={() => setAttendanceOpen(false)}
        />
      )}
      {settings && (
        <ShiftSettings
          plan={plan}
          data={data}
          onClose={() => setSettings(false)}
          onSave={(value) => {
            update(value)
            setSettings(false)
          }}
        />
      )}
      {warning && (
        <ConfirmDialog
          title="希望時間外の勤務を含みます"
          description="希望未提出または参加可能時間外のメンバーがいます。この内容で保存しますか。"
          confirmLabel="保存する"
          onCancel={() => setWarning(false)}
          onConfirm={() => {
            setWarning(false)
            void save(true)
          }}
        />
      )}
      {blocker.status === "blocked" && (
        <ConfirmDialog
          title="変更を破棄しますか"
          description="保存していない変更があります。"
          confirmLabel="破棄して移動"
          onCancel={() => blocker.reset()}
          onConfirm={() => blocker.proceed()}
        />
      )}
    </section>
  )
}
function ShiftSettings({
  plan,
  data,
  onSave,
  onClose,
}: {
  plan: ActivityEditorInput
  data: EditorData
  onSave: (plan: ActivityEditorInput) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(plan)
  return (
    <ResponsiveDialog
      open
      title="シフトの設定"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(value)
        }}
      >
        <label htmlFor="shift-name" className="block space-y-2 text-sm">
          名前
          <Input
            id="shift-name"
            required
            value={value.name}
            onChange={(event) =>
              setValue({ ...value, name: event.target.value })
            }
          />
        </label>
        <label htmlFor="shift-place" className="block space-y-2 text-sm">
          場所
          <Input
            id="shift-place"
            required
            value={value.place}
            onChange={(event) =>
              setValue({ ...value, place: event.target.value })
            }
          />
        </label>
        <label htmlFor="shift-start" className="block space-y-2 text-sm">
          開始
          <Input
            id="shift-start"
            type="datetime-local"
            required
            value={local(value.startsAt)}
            onChange={(e) => {
              const at = japanLocalDateTime(e.target.value)
              if (Number.isFinite(at))
                setValue({ ...value, startsAt: new Date(at).toISOString() })
            }}
          />
        </label>
        <label htmlFor="shift-end" className="block space-y-2 text-sm">
          終了
          <Input
            id="shift-end"
            type="datetime-local"
            required
            value={local(value.endsAt)}
            onChange={(e) => {
              const at = japanLocalDateTime(e.target.value)
              if (Number.isFinite(at))
                setValue({ ...value, endsAt: new Date(at).toISOString() })
            }}
          />
        </label>
        <label
          htmlFor="shift-color"
          className="flex items-center justify-between text-sm"
        >
          色
          <Input
            id="shift-color"
            type="color"
            className="w-12 p-1"
            value={value.color}
            onChange={(e) => setValue({ ...value, color: e.target.value })}
          />
        </label>
        <label htmlFor="shift-notes" className="block space-y-2 text-sm">
          備考
          <Input
            id="shift-notes"
            value={value.notes ?? ""}
            onChange={(e) =>
              setValue({ ...value, notes: e.target.value || null })
            }
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm">対象のロール</legend>
          {data.roles.map((role) => (
            <label
              key={role.id}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.candidateRoleIds.includes(role.id)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    candidateRoleIds: e.target.checked
                      ? [...value.candidateRoleIds, role.id]
                      : value.candidateRoleIds.filter((id) => id !== role.id),
                  })
                }
              />
              {role.name}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center justify-between text-sm">
          有効
          <input
            type="checkbox"
            checked={value.active}
            onChange={(event) =>
              setValue({ ...value, active: event.target.checked })
            }
          />
        </label>
        <fieldset className="max-h-60 overflow-auto">
          <legend className="mb-2 text-sm">責任者</legend>
          {[
            ...data.roles.map((role) => ({
              targetType: "role" as const,
              targetId: role.id,
              name: role.name,
            })),
            ...data.members.map((member) => ({
              targetType: "member" as const,
              targetId: member.id,
              name: member.displayName,
            })),
          ].map((target) => (
            <label
              key={`${target.targetType}-${target.targetId}`}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.responsibles.some(
                  (item) =>
                    item.targetType === target.targetType &&
                    item.targetId === target.targetId
                )}
                onChange={(event) =>
                  setValue({
                    ...value,
                    responsibles: event.target.checked
                      ? [
                          ...value.responsibles,
                          {
                            targetType: target.targetType,
                            targetId: target.targetId,
                          },
                        ]
                      : value.responsibles.filter(
                          (item) =>
                            item.targetType !== target.targetType ||
                            item.targetId !== target.targetId
                        ),
                  })
                }
              />
              {target.name}
            </label>
          ))}
        </fieldset>
        <Button>適用</Button>
      </form>
    </ResponsiveDialog>
  )
}
