import { useQuery } from "@tanstack/react-query"

import { getAvailabilitySubmissions } from "@/api/availability"

export function AvailabilitySummary({ year }: { year: number }) {
  const submissions = useQuery({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year),
  })

  return (
    <section>
      <h2 className="flex min-h-11 items-center border-b font-medium">
        シフト希望状況
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {submissions.data?.submissions.length ?? 0}件
        </span>
      </h2>
      <ul className="divide-y border-b text-sm">
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
    </section>
  )
}
