import { useQuery } from "@tanstack/react-query"

import { getAvailabilitySubmissions } from "@/api/availability"

export function AvailabilitySummary({ year }: { year: number }) {
  const submissions = useQuery({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year),
  })

  return (
    <details className="rounded-xl border bg-card p-4 shadow-xs">
      <summary className="cursor-pointer font-medium">
        シフト希望状況
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {submissions.data?.submissions.length ?? 0}件
        </span>
      </summary>
      <ul className="mt-4 divide-y border-t text-sm">
        {submissions.data?.submissions.map((submission) => (
          <li
            key={submission.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span>{submission.member.displayName}</span>
            <span className="text-xs text-muted-foreground">
              {submission.status === "submitted" ? "提出済み" : "下書き"} ·{" "}
              {submission.windows.length}枠
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
