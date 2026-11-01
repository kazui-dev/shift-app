import type { timeScale } from "./time-scale"

export function TimeGuides({
  scale,
}: {
  scale: Pick<ReturnType<typeof timeScale>, "start" | "duration">
}) {
  const offset = scale.start % 3_600_000
  const minutes = (scale.duration + offset) / 60_000
  return (
    <span className="shift-gridlines" aria-hidden="true">
      <span
        style={{
          left: `${(-offset / scale.duration) * 100}%`,
          width: `${((scale.duration + offset) / scale.duration) * 100}%`,
          backgroundSize: `calc(100% / ${minutes} * var(--shift-tick-minutes, 60)) 100%`,
        }}
      />
    </span>
  )
}
