import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import {
  getAssignmentReports,
  resolveAssignmentReport,
} from "@/api/assignments"
import { errorMessage } from "@/api/client"

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function ReportManager({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const reports = useQuery({
    queryKey: ["assignment-reports", year],
    queryFn: () => getAssignmentReports(year),
  })
  const [pending, setPending] = useState(false)

  async function resolveReport(reportId: string) {
    setPending(true)
    try {
      await resolveAssignmentReport(reportId)
      await queryClient.invalidateQueries({
        queryKey: ["assignment-reports", year],
      })
      toast.success("連絡を対応済みにしました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h2 className="flex min-h-11 items-center border-b font-medium">
        遅刻・欠勤連絡
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {reports.data?.reports.filter((report) => report.status === "open")
            .length ?? 0}
          件未対応
        </span>
      </h2>
      <ul className="divide-y border-b text-sm">
        {reports.data?.reports.map((report) => (
          <li key={report.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {report.kind === "late" ? "遅刻" : "欠勤"} ·{" "}
                  {report.memberDisplayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report.activityName} · {dateTime(report.startsAt)}
                </p>
                <p className="mt-2">{report.message}</p>
              </div>
              {report.status === "open" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void resolveReport(report.id)}
                >
                  対応済み
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">対応済み</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
