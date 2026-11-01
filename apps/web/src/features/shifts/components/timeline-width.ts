export const DEFAULT_HOUR_WIDTH = 96
export const MIN_HOUR_WIDTH = 48
export const MAX_HOUR_WIDTH = 384
export const HOUR_MS = 3_600_000

export function clampHourWidth(width: number) {
  return Math.max(MIN_HOUR_WIDTH, Math.min(MAX_HOUR_WIDTH, Math.round(width)))
}

export function timelineStep(width: number) {
  return width >= 240 ? 15 : width >= 120 ? 30 : 60
}

export function timelineMarks(
  start: number,
  end: number,
  width: number,
  step = timelineStep(width)
) {
  const interval = step * 60_000
  const marks = [start]
  for (
    let time = Math.ceil(start / interval) * interval;
    time < end;
    time += interval
  ) {
    if (
      time > start &&
      ((time - start) / HOUR_MS) * width >= 44 &&
      ((end - time) / HOUR_MS) * width >= 44
    )
      marks.push(time)
  }
  if (((end - start) / HOUR_MS) * width >= 44) marks.push(end)
  return marks
}

export function resizedHourWidth(
  width: number,
  distance: number,
  intervalHours: number
) {
  return clampHourWidth(width + distance / intervalHours)
}

export function anchoredScroll(
  width: number,
  offsetHours: number,
  viewportX: number,
  nameWidth: number
) {
  return Math.max(0, nameWidth + 24 + offsetHours * width - viewportX)
}
