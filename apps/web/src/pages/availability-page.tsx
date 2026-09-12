import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { skipToken, useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePage,
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { useDisplayYear } from "@/components/use-display-year"
import { getAvailability } from "@/api/availability"
import { AvailabilityEditor } from "@/components/availability/availability-editor"

export function AvailabilityPage() {
  const display = useDisplayYear()
  const navigate = useNavigate()
  const { state } = getRouteApi("/_app").useRouteContext()
  const year = display.year
  const query = useQuery({
    queryKey: ["availability", year],
    queryFn: year === null ? skipToken : () => getAvailability(year),
    staleTime: 60_000,
  })
  const close = () => {
    void navigate({ to: "/calendar" })
  }
  return (
    <div className="fixed inset-0 z-40">
      <ResponsivePage open onClose={close}>
        {year !== null && query.data ? (
          <AvailabilityEditor
            key={year}
            year={year}
            user={state.member.studentId}
            data={query.data}
            onClose={close}
          />
        ) : (
          <>
            <ResponsivePageHeader title="シフト希望" onBack={close} />
            <ResponsivePageBody>
              {query.isError ? (
                <div className="space-y-3">
                  <p>希望を読み込めませんでした。</p>
                  <Button onClick={() => void query.refetch()}>
                    再読み込み
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {display.isPending || (query.isPending && year !== null)
                    ? "読み込み中…"
                    : "参加年度がありません。"}
                </p>
              )}
            </ResponsivePageBody>
          </>
        )}
      </ResponsivePage>
    </div>
  )
}
