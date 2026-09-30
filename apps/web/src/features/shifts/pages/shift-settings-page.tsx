import { useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { getRouteApi, Link, useBlocker } from "@tanstack/react-router"
import { PageHeader } from "@workspace/ui/components/page-header"
import { toast } from "@workspace/ui/lib/toast"
import { keys } from "@/app/data/keys"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ApiError, errorMessage } from "@/lib/http/client"
import { getActivity, saveActivity } from "../api/activities"
import { activityQuery } from "../data/activities"
import type { EditorData } from "../editor-data"
import { ShiftConflicts } from "../components/shift-conflicts"
import { ShiftSettings } from "../components/shift-settings"
import { hasUnavailableAssignments } from "../components/availability-warning"
import { planOf } from "../components/use-shift-plan"

const route = getRouteApi("/_app/manage/shifts_/$shiftId_/settings")

export function ShiftSettingsPage() {
  const { shiftId } = route.useParams()
  const query = useSuspenseQuery({
    ...activityQuery(shiftId),
    refetchOnWindowFocus: false,
  })
  return <ShiftSettingsScreen key={shiftId} source={query.data} />
}

function ShiftSettingsScreen({ source }: { source: EditorData }) {
  const client = useQueryClient()
  const id = source.activity.id
  const [base, setBase] = useState(() => planOf(source))
  const [value, setValue] = useState(() => planOf(source))
  const [latest, setLatest] = useState<EditorData | null>(null)
  const [warning, setWarning] = useState(false)
  const [pending, setPending] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(base)
  const blocker = useBlocker({
    shouldBlockFn: () => dirty || pending,
    enableBeforeUnload: dirty,
    withResolver: true,
  })

  async function save(confirmed = false) {
    if (hasUnavailableAssignments(value, source.availability) && !confirmed) {
      setWarning(true)
      return
    }
    setPending(true)
    try {
      const result = await saveActivity(id, {
        ...value,
        version: base.version,
      })
      client.setQueryData(keys.activityEditor(id), result)
      void client.invalidateQueries({
        queryKey: keys.activities(source.activity.year),
      })
      const saved = planOf(result)
      setBase(saved)
      setValue(saved)
      toast.success("保存しました。")
    } catch (error) {
      toast.error(`${errorMessage(error)} 編集内容は保持しています。`)
      if (error instanceof ApiError && error.code === "SHIFT_CHANGED") {
        try {
          setLatest(await getActivity(id))
        } catch (refreshError) {
          toast.error(errorMessage(refreshError))
        }
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader className="sm:px-6">
        <Link
          to="/manage/shifts/$shiftId"
          params={{ shiftId: id }}
          className="max-w-28 truncate text-sm text-muted-foreground hover:text-foreground sm:max-w-56"
        >
          ← {source.activity.name}
        </Link>
        <h2 className="flex-1 text-base font-medium">基本情報</h2>
        <span className="text-sm text-muted-foreground">
          {source.activity.year}年度
        </span>
      </PageHeader>
      <div className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto px-4 py-6 sm:px-6">
        <ShiftSettings
          value={value}
          data={source}
          dirty={dirty}
          pending={pending}
          onChange={setValue}
          onSubmit={() => void save()}
        />
      </div>
      {latest && (
        <ShiftConflicts
          base={base}
          data={latest}
          local={value}
          latest={planOf(latest)}
          onClose={() => setLatest(null)}
          onMerge={(merged) => {
            client.setQueryData(keys.activityEditor(id), latest)
            setBase(planOf(latest))
            setValue(merged)
            setLatest(null)
          }}
        />
      )}
      {warning && (
        <ConfirmDialog
          title="希望時間外の勤務を含めて保存しますか"
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
          title={
            pending ? "保存処理中です" : "未保存の変更を破棄して移動しますか"
          }
          confirmLabel="移動する"
          onCancel={() => blocker.reset()}
          onConfirm={() => {
            if (!pending) blocker.proceed()
          }}
        />
      )}
    </section>
  )
}
