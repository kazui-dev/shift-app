import { expect, it } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { memberAvailability } from "./member-availability"
import { gridMembers } from "./time-scale"
const at = (time: string) => `2026-11-01T${time}:00+09:00`
function fixture() {
  const data = makeEditors()[0]
  if (!data) throw new Error("Missing fixture")
  const member = data.members[0]
  if (!member) throw new Error("Missing member")
  data.members = [member]
  data.availabilityAnswers = [
    { memberId: member.id, date: "2026-11-01", choice: "times" },
  ]
  data.availability = [
    { memberId: member.id, startsAt: at("09:00"), endsAt: at("11:00") },
  ]
  data.otherAssignments = []
  const plan = {
    ...data.activity,
    startsAt: at("09:00"),
    endsAt: at("11:00"),
    slots: data.slots,
    requirements: [],
    responsibles: [],
    candidateRoleIds: [],
  }
  return { data, plan, id: member.id }
}
it("distinguishes this day's answer from another day or stale availability", () => {
  const { data, plan, id } = fixture()
  expect(memberAvailability(data, plan, id)).toBe("available")
  data.availabilityAnswers = [
    { memberId: id, date: "2026-11-01", choice: "no" },
  ]
  expect(memberAvailability(data, plan, id)).toBe("unavailable")
  data.availabilityAnswers = [
    { memberId: id, date: "2026-11-02", choice: "times" },
  ]
  expect(memberAvailability(data, plan, id)).toBe("unanswered")
})
it("subtracts the union of other work, retaining even a one-minute gap", () => {
  const { data, plan, id } = fixture()
  const busy = (from: string, to: string) => ({
    memberId: id,
    startsAt: at(from),
    endsAt: at(to),
    name: "他の仕事",
  })
  data.otherAssignments = [
    busy("10:00", "11:00"),
    busy("09:00", "10:00"),
    busy("08:00", "09:00"),
  ]
  expect(memberAvailability(data, plan, id)).toBe("unavailable")
  data.otherAssignments = [busy("10:01", "12:00"), busy("08:00", "10:00")]
  expect(memberAvailability(data, plan, id)).toBe("available")
  data.availability = [
    { memberId: id, startsAt: at("08:00"), endsAt: at("10:00") },
  ]
  expect(memberAvailability(data, plan, id)).toBe("unavailable")
  data.otherAssignments = [busy("11:00", "12:00")]
  expect(memberAvailability(data, plan, id)).toBe("available")
  data.availability = [
    { memberId: id, startsAt: at("11:00"), endsAt: at("12:00") },
  ]
  expect(memberAvailability(data, plan, id)).toBe("unavailable")
})
it("treats a fully booked unanswered member as unavailable", () => {
  const { data, plan, id } = fixture()
  data.availabilityAnswers = []
  data.otherAssignments = [
    { memberId: id, startsAt: at("09:00"), endsAt: at("11:00"), name: "他" },
  ]
  expect(memberAvailability(data, plan, id)).toBe("unavailable")
})
it("uses each Japanese calendar day and excludes the end date at midnight", () => {
  const { data, plan, id } = fixture()
  data.availabilityAnswers = [
    { memberId: id, date: "2026-11-01", choice: "no" },
  ]
  plan.endsAt = "2026-11-02T00:00:00+09:00"
  expect(memberAvailability(data, plan, id)).toBe("unavailable")
  plan.endsAt = "2026-11-02T00:01:00+09:00"
  expect(memberAvailability(data, plan, id)).toBe("unanswered")
})
it("adds each hidden category independently without losing search and role filters", () => {
  const { data, plan, id } = fixture()
  const filters = {
    search: "",
    role: "",
    includeUnavailable: false,
    includeUnanswered: false,
  }
  expect(gridMembers(data, plan, filters)).toHaveLength(1)
  data.availabilityAnswers = []
  expect(gridMembers(data, plan, filters)).toEqual([])
  expect(
    gridMembers(data, plan, { ...filters, includeUnavailable: true })
  ).toEqual([])
  expect(
    gridMembers(data, plan, { ...filters, includeUnanswered: true })
  ).toHaveLength(1)
  data.availabilityAnswers = [
    { memberId: id, date: "2026-11-01", choice: "no" },
  ]
  expect(
    gridMembers(data, plan, { ...filters, includeUnanswered: true })
  ).toEqual([])
  expect(
    gridMembers(data, plan, { ...filters, includeUnavailable: true })
  ).toHaveLength(1)
  expect(
    gridMembers(data, plan, {
      ...filters,
      includeUnavailable: true,
      search: "absent",
    })
  ).toEqual([])
})
