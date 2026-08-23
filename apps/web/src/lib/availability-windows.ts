export type AvailabilityWindowInput = {
  id: string
  date: string
  startsAt: string
  endsAt: string
}

export function validateAvailabilityWindows(
  windows: AvailabilityWindowInput[]
): string | null {
  if (windows.length > 64) return "時間帯は64件まで追加できます。"

  if (
    windows.some(
      (window) =>
        window.startsAt.slice(0, 10) !== window.date ||
        window.endsAt.slice(0, 10) !== window.date
    )
  ) {
    return "時間帯は同じ日付の中で入力してください。"
  }

  const ranges = windows
    .map((window) => ({
      start: Date.parse(window.startsAt),
      end: Date.parse(window.endsAt),
    }))
    .sort((left, right) => left.start - right.start)

  if (
    ranges.some(
      (range) =>
        Number.isNaN(range.start) ||
        Number.isNaN(range.end) ||
        range.start >= range.end
    )
  ) {
    return "終了時刻は開始時刻より後にしてください。"
  }

  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1]
    const current = ranges[index]
    if (previous && current && previous.end > current.start) {
      return "時間帯が重複しています。"
    }
  }

  return null
}
