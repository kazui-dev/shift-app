type Window = { startsAt: string; endsAt: string }
/** Subtract only the new working intervals, retaining both sides of an old assignment. */
export function remainingAssignment(
  original: Window,
  replacements: Window[]
): Window[] {
  let pieces = [
    { start: Date.parse(original.startsAt), end: Date.parse(original.endsAt) },
  ]
  for (const replacement of replacements) {
    const start = Date.parse(replacement.startsAt),
      end = Date.parse(replacement.endsAt)
    pieces = pieces.flatMap((piece) => {
      if (start >= piece.end || end <= piece.start) return [piece]
      return [
        ...(piece.start < start ? [{ start: piece.start, end: start }] : []),
        ...(end < piece.end ? [{ start: end, end: piece.end }] : []),
      ]
    })
  }
  return pieces.map((piece) => ({
    startsAt: new Date(piece.start).toISOString(),
    endsAt: new Date(piece.end).toISOString(),
  }))
}
