import { useQuery } from "@tanstack/react-query"

import { getAvailabilitySubmissions } from "@/api/availability"

export function AvailabilitySummary({ year }: { year: number }) {
  const submissions = useQuery({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year),
  })

  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-medium">
        希望提出状況（{submissions.data?.submissions.length ?? 0}件）
      </summary>
      <ul className="mt-3 space-y-2 text-sm">
        {submissions.data?.submissions.map((submission) => (
          <li key={submission.id} className="border-b pb-2">
            {submission.member.displayName} ·{" "}
            {submission.status === "submitted" ? "提出済み" : "下書き"} ·{" "}
            {submission.windows.length}枠
          </li>
        ))}
      </ul>
    </details>
  )
}
