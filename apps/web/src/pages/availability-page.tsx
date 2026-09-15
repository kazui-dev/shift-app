import { RoutePage } from "@/components/route-page"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { useDisplayYear } from "@/components/use-display-year"
import { availabilityQuery } from "@/data/availability"
import { AvailabilityEditor } from "@/components/availability/availability-editor"

export function AvailabilityPage() {
  const display = useDisplayYear()
  const navigate = useNavigate()
  const { state } = getRouteApi("/_app").useRouteContext()
  const year = display.year
  const query = useQuery(availabilityQuery(year))
  const close = () => void navigate({ to: "/calendar" })
  return (
    <div className="fixed inset-0 z-40">
      <RoutePage onClose={close}>
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
      </RoutePage>
    </div>
  )
}
