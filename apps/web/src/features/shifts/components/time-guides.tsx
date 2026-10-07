import type { timeScale } from "./time-scale"

export function TimeGuides({ scale }: { scale: ReturnType<typeof timeScale> }) {
  return (
    <span className="shift-gridlines" aria-hidden="true">
      {scale.hours.map((time) => (
        <span
          key={time}
          style={{ left: `${((time - scale.start) / scale.duration) * 100}%` }}
        />
      ))}
    </span>
  )
}
