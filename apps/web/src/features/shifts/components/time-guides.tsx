import type { timeScale } from "./time-scale"

export function TimeGuides({
  scale,
  stepMinutes,
}: {
  scale: ReturnType<typeof timeScale>
  stepMinutes?: number
}) {
  const marks = stepMinutes
    ? Array.from(
        { length: Math.floor(scale.duration / (stepMinutes * 60_000)) + 1 },
        (_, i) => scale.start + i * stepMinutes * 60_000
      )
    : scale.hours
  return (
    <span className="shift-gridlines" aria-hidden="true">
      {marks.map((time) => (
        <span
          key={time}
          style={{ left: `${((time - scale.start) / scale.duration) * 100}%` }}
        />
      ))}
    </span>
  )
}
