import { expect, it } from "vite-plus/test"
import {
  cardActionsOpen,
  reportLabel,
  reportOpen,
  standingReport,
} from "@/components/calendar/assignment-actions"

const shift = {
  startsAt: "2026-09-15T01:00:00.000Z",
  endsAt: "2026-09-15T02:00:00.000Z",
  checkedInAt: null,
}
const at = (iso: string) => Date.parse(iso)

it("offers check-in from 30 minutes before a shift until it ends, until checked in", () => {
  expect(cardActionsOpen(shift, at("2026-09-15T00:29:59.999Z"))).toBe(false)
  expect(cardActionsOpen(shift, at("2026-09-15T00:30:00.000Z"))).toBe(true)
  expect(cardActionsOpen(shift, at("2026-09-15T01:59:59.999Z"))).toBe(true)
  expect(cardActionsOpen(shift, at("2026-09-15T02:00:00.000Z"))).toBe(false)
  expect(
    cardActionsOpen(
      { ...shift, checkedInAt: "2026-09-15T01:00:00.000Z" },
      at("2026-09-15T01:10:00.000Z")
    )
  ).toBe(false)
})

it("takes late or absence reports until a shift ends", () => {
  expect(reportOpen(shift, at("2026-09-14T00:00:00.000Z"))).toBe(true)
  expect(reportOpen(shift, at("2026-09-15T02:00:00.000Z"))).toBe(false)
})

it("reads a standing report on its shift, and none once taken back", () => {
  const report = (
    kind: "late" | "absence",
    eta: string | null,
    status: "open" | "resolved" | "withdrawn" = "open"
  ) => ({ report: { kind, message: "", eta, status } })
  expect(reportLabel({ report: null })).toBe("遅刻・欠勤")
  expect(reportLabel(report("absence", null))).toBe("欠勤連絡済み")
  expect(reportLabel(report("late", null, "resolved"))).toBe("遅刻連絡済み")
  expect(reportLabel(report("late", "2026-09-15T01:30:00.000Z"))).toBe(
    "遅刻連絡済み・10:30到着"
  )
  expect(standingReport(report("late", null, "withdrawn"))).toBeNull()
  expect(reportLabel(report("late", null, "withdrawn"))).toBe("遅刻・欠勤")
})
