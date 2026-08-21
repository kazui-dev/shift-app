import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"

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
  const [message, setMessage] = useState<string | null>(null)

  async function resolveReport(reportId: string) {
    setPending(true)
    setMessage(null)
    try {
      await resolveAssignmentReport(reportId)
      await queryClient.invalidateQueries({
        queryKey: ["assignment-reports", year],
      })
      setMessage("連絡を対応済みにしました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <details className="rounded-lg border p-4" open>
      <summary className="cursor-pointer font-medium">
        遅刻・欠勤連絡（
        {reports.data?.reports.filter((report) => report.status === "open")
          .length ?? 0}
        件未対応）
      </summary>
      <ul className="mt-3 space-y-2 text-sm">
        {reports.data?.reports.map((report) => (
          <li key={report.id} className="rounded-md border p-3">
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
      {message && <p className="mt-3 text-sm">{message}</p>}
    </details>
  )
}
