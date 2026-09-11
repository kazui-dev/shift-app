import { getRouteApi } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { getActivity } from "@/api/activities"
import { errorMessage } from "@/api/client"
import { ShiftEditor } from "@/components/shifts/shift-editor"
const route = getRouteApi("/_app/manage/shifts_/$shiftId")
export function ShiftEditorPage() {
  const { shiftId: id } = route.useParams()
  const query = useQuery({
    queryKey: ["activity-editor", id],
    queryFn: () => getActivity(id),
    refetchOnWindowFocus: false,
  })
  if (query.isPending)
    return <p className="text-sm text-muted-foreground">読み込み中…</p>
  if (query.isError) return <p role="alert">{errorMessage(query.error)}</p>
  return <ShiftEditor key={id} data={query.data} />
}
