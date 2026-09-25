import type { CSSProperties } from "react"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { ShiftSelection } from "./shift-selection-panel"
import type { EditorData } from "../editor-data"

const STEP = 300_000

/** Maps the shift's window onto the grid: minutes, hour marks and widths. */
export function timeScale(startsAt: string, endsAt: string) {
  const start = Date.parse(startsAt),
    end = Date.parse(endsAt),
    duration = end - start
  const firstHour = Math.ceil(start / 3_600_000) * 3_600_000
  const hours = [
    ...new Set([
      start,
      ...Array.from(
        { length: Math.max(0, Math.ceil((end - firstHour) / 3_600_000)) },
        (_, index) => firstHour + index * 3_600_000
      ),
      end,
    ]),
  ]
  return {
    start,
    end,
    duration,
    hours,
    /** Hour marks far enough from the edges to be readable. */
    labels: hours.filter(
      (hour) =>
        hour === start ||
        hour === end ||
        (hour - start >= 1_800_000 && end - hour >= 1_800_000)
    ),
    /** The minute of the shift under a pointer, snapped to five minutes. */
    minuteAt: (x: number, left: number, width: number) =>
      Math.max(
        0,
        Math.min(
          Math.floor(duration / 60_000),
          (Math.round((start + ((x - left) / width) * duration) / STEP) * STEP -
            start) /
            60_000
        )
      ),
    /** A selection covering the dragged minutes, at least one minute long. */
    range: (memberId: string, from: number, to: number): ShiftSelection => {
      const max = Math.floor(duration / 60_000)
      const first = Math.min(Math.min(from, to), max - 1)
      const last = Math.min(max, Math.max(first + 1, Math.max(from, to)))
      return {
        memberId,
        slotId: null,
        startsAt: new Date(start + first * 60_000).toISOString(),
        endsAt: new Date(start + last * 60_000).toISOString(),
      }
    },
    /** An interval placed across the grid, clipped to the shift. */
    position: (from: string, to: string): CSSProperties => {
      const left = Math.max(start, Date.parse(from)),
        right = Math.min(end, Date.parse(to))
      return {
        left: `${((left - start) / duration) * 100}%`,
        width: `${Math.max(0, ((right - left) / duration) * 100)}%`,
      }
    },
    /** Moves one edge of a slot, keeping it at least five minutes long. */
    resize: (
      slot: ActivityEditorInput["slots"][number],
      edge: string,
      minute: number
    ): ShiftSelection => {
      const value = start + minute * 60_000
      return {
        memberId: "",
        slotId: slot.id,
        startsAt:
          edge === "start"
            ? new Date(
                Math.max(
                  start,
                  Math.min(
                    value,
                    Math.floor((Date.parse(slot.endsAt) - 1) / STEP) * STEP
                  )
                )
              ).toISOString()
            : slot.startsAt,
        endsAt:
          edge === "end"
            ? new Date(
                Math.min(
                  end,
                  Math.max(
                    value,
                    Math.ceil((Date.parse(slot.startsAt) + 1) / STEP) * STEP
                  )
                )
              ).toISOString()
            : slot.endsAt,
      }
    },
  }
}

/** The members the grid shows for the current filters. */
export function gridMembers(
  data: EditorData,
  plan: ActivityEditorInput,
  filters: { search: string; role: string; includeUnavailable: boolean },
  window: { start: number; end: number }
) {
  const term = filters.search.trim().toLocaleLowerCase()
  return data.members.filter(
    (member) =>
      (filters.includeUnavailable ||
        data.availability.some(
          (item) =>
            item.memberId === member.id &&
            Date.parse(item.startsAt) < window.end &&
            Date.parse(item.endsAt) > window.start
        )) &&
      `${member.displayName} ${member.studentId}`
        .toLocaleLowerCase()
        .includes(term) &&
      (!filters.role ||
        member.roles.some((item) =>
          filters.role === "candidates"
            ? plan.candidateRoleIds.includes(item.id)
            : item.id === filters.role
        ))
  )
}
