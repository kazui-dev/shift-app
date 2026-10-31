import { japanMonthDayWeekday, japanTime } from "@workspace/shared/japan-time"
import { NavigationGuard } from "@/components/navigation-guard"
import { useState } from "react"
import { activityQuery } from "@/features/shifts/data/activities"
import { getRouteApi, Link, useRouterState } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ShiftEditor } from "@/features/shifts/components/shift-editor"
import { ManagementPage } from "@/features/management/components/page"

const route = getRouteApi("/_app/manage/shifts_/$shiftId")
export function ShiftEditorPage() {
  const { shiftId: id } = route.useParams()
  return <ShiftEditorScreen key={id} id={id} />
}
function ShiftEditorScreen({ id }: { id: string }) {
  const navigating = useRouterState({ select: (state) => state.isLoading })
  const [editor, setEditor] = useState({ dirty: false, pending: false })
  const query = useSuspenseQuery({
    ...activityQuery(id),
    refetchOnWindowFocus: false,
  })
  return (
    <ManagementPage
      inert={navigating}
      aria-busy={navigating}
      header={
        <>
          <Link
            to="/manage/shifts"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← シフト一覧
          </Link>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="min-w-0 truncate text-base font-medium">
              {query.data.activity.name}
            </h2>
            <span className="shrink-0 text-sm tabular-nums">
              {japanMonthDayWeekday(query.data.activity.startsAt)}{" "}
              {japanTime(query.data.activity.startsAt)}-
              {japanTime(query.data.activity.endsAt)}
            </span>
          </div>
        </>
      }
    >
      <ShiftEditor
        data={query.data}
        optionsReady={query.isSuccess && !query.isFetching}
        onStatusChange={setEditor}
      />
      <NavigationGuard dirty={editor.dirty} pending={editor.pending} />
    </ManagementPage>
  )
}
