import { activityQuery } from "@/data/activities"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { ShiftEditor } from "@/components/shifts/shift-editor"
import {
  ResponsivePage,
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { Button } from "@workspace/ui/components/button"
import { usePageClose } from "@/components/use-page-close"

const route = getRouteApi("/_app/manage/shifts_/$shiftId")
export function ShiftEditorPage() {
  const navigate = useNavigate()
  const page = usePageClose(
    () => void navigate({ to: "/manage/shifts", replace: true }),
    "page"
  )
  const { shiftId: id } = route.useParams()
  const query = useQuery({
    ...activityQuery(id),
    refetchOnWindowFocus: false,
  })
  if (!query.data)
    return (
      <div className="fixed inset-0 z-40 md:contents">
        <ResponsivePage
          open={page.open}
          onClose={page.close}
          onClosed={page.onClosed}
          desktop="page"
        >
          <ResponsivePageHeader title="シフト" onBack={page.close} />
          <ResponsivePageBody>
            {query.isError ? (
              <Button onClick={() => void query.refetch()}>再読み込み</Button>
            ) : (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            )}
          </ResponsivePageBody>
        </ResponsivePage>
      </div>
    )
  return <ShiftEditor key={id} data={query.data} />
}
