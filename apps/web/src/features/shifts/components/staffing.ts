import type { ActivityEditorInput } from "@workspace/shared/shifts"

/** Half-open intervals split at every real change, never at fixed time buckets. */
export function staffing(
  plan: Pick<
    ActivityEditorInput,
    "startsAt" | "endsAt" | "requirements" | "slots"
  >
) {
  const start = Date.parse(plan.startsAt),
    end = Date.parse(plan.endsAt)
  const boundaries = [
    ...new Set([
      start,
      end,
      ...[...plan.requirements, ...plan.slots]
        .flatMap((item) => [Date.parse(item.startsAt), Date.parse(item.endsAt)])
        .filter((at) => at > start && at < end),
    ]),
  ].sort((a, b) => a - b)
  return boundaries.flatMap((at, index) => {
    const until = boundaries[index + 1]
    if (until === undefined) return []
    const requirement = plan.requirements.find(
      (item) => Date.parse(item.startsAt) <= at && Date.parse(item.endsAt) > at
    )
    const assigned = new Set(
      plan.slots
        .filter(
          (slot) =>
            Date.parse(slot.startsAt) <= at && Date.parse(slot.endsAt) > at
        )
        .flatMap((slot) => slot.memberIds)
    ).size
    const required = requirement?.requiredCount ?? null
    return [
      {
        startsAt: new Date(at).toISOString(),
        endsAt: new Date(until).toISOString(),
        assigned,
        required,
        shortage: required !== null && assigned < required,
      },
    ]
  })
}
