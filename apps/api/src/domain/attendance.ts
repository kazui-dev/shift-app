export function isCheckInTime(
  now: number,
  startsAt: number,
  endsAt: number
): boolean {
  return now >= startsAt && now <= endsAt
}
