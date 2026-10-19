export function ShiftMemberLabel({
  name,
  studentId,
  duties,
  status = "available",
}: {
  name: string
  studentId: string
  duties: string[]
  status?: "available" | "unavailable" | "unanswered"
}) {
  const details = [
    status === "unavailable" && "参加不可",
    status === "unanswered" && "未回答",
    duties.join("・"),
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <span className="min-w-0">
      <span className="flex items-baseline gap-1.5 leading-5">
        <span className="min-w-0 truncate" title={name}>
          {name}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {studentId}
        </span>
      </span>
      {details && (
        <span
          className="block truncate text-[11px] leading-4 text-muted-foreground"
          title={details}
        >
          {details}
        </span>
      )}
    </span>
  )
}
