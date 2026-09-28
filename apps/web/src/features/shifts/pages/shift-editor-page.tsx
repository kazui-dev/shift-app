import { useState } from "react"
import { activityQuery } from "@/features/shifts/data/activities"
import {
  getRouteApi,
  Link,
  useBlocker,
  useRouterState,
} from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ShiftEditor } from "@/features/shifts/components/shift-editor"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@workspace/ui/components/page-header"

const route = getRouteApi("/_app/manage/shifts_/$shiftId")
export function ShiftEditorPage() {
  const { shiftId: id } = route.useParams()
  return <ShiftEditorScreen key={id} id={id} />
}
function ShiftEditorScreen({ id }: { id: string }) {
  const navigating = useRouterState({ select: (state) => state.isLoading })
  const [editor, setEditor] = useState({ dirty: false, pending: false })
  const blocker = useBlocker({
    shouldBlockFn: () => editor.dirty || editor.pending,
    enableBeforeUnload: editor.dirty,
    withResolver: true,
  })
  const query = useSuspenseQuery({
    ...activityQuery(id),
    refetchOnWindowFocus: false,
  })
  return (
    <div
      inert={navigating}
      aria-busy={navigating}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <PageHeader className="sm:px-6">
        <Link
          to="/manage/shifts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← シフト一覧
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-base font-medium">
          {query.data.activity.name}
        </h2>
        <span className="text-sm text-muted-foreground">
          {query.data.activity.year}年度
        </span>
      </PageHeader>
      <ShiftEditor data={query.data} onStatusChange={setEditor} />
      {blocker.status === "blocked" && (
        <ConfirmDialog
          title={
            editor.pending
              ? "保存処理中です"
              : "未保存の変更を破棄して移動しますか"
          }
          confirmLabel="移動する"
          onCancel={() => blocker.reset()}
          onConfirm={() => {
            if (!editor.pending) blocker.proceed()
          }}
        />
      )}
    </div>
  )
}
