import { useState } from "react"
import { activityQuery } from "@/data/activities"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { ShiftEditor } from "@/components/shifts/shift-editor"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { Button } from "@workspace/ui/components/button"
import { RoutePage } from "@/components/route-page"

const route = getRouteApi("/_app/manage/shifts_/$shiftId")
export function ShiftEditorPage() {
  const { shiftId: id } = route.useParams()
  return <ShiftEditorScreen key={id} id={id} />
}
function ShiftEditorScreen({ id }: { id: string }) {
  const [editor, setEditor] = useState({ dirty: false, pending: false })
  const navigate = useNavigate()
  const close = () => {
    if (!editor.pending) void navigate({ to: "/manage/shifts", replace: true })
  }
  const query = useQuery({
    ...activityQuery(id),
    refetchOnWindowFocus: false,
  })
  return (
    <div className="fixed inset-0 z-40 md:contents">
      <RoutePage onClose={close} desktop="page" dirty={editor.dirty}>
        {query.data ? (
          <ShiftEditor data={query.data} onStatusChange={setEditor} />
        ) : (
          <>
            <ResponsivePageHeader title="シフト" onBack={close} />
            <ResponsivePageBody>
              {query.isError ? (
                <Button onClick={() => void query.refetch()}>再読み込み</Button>
              ) : (
                <p className="text-sm text-muted-foreground">読み込み中…</p>
              )}
            </ResponsivePageBody>
          </>
        )}
      </RoutePage>
    </div>
  )
}
