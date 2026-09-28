import type { ActivityEditorInput } from "@workspace/shared/shifts"

type Choice = "local" | "latest"
type PlanConflict = {
  key: string
  label: string
  local: unknown
  latest: unknown
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function mergePlan(
  base: ActivityEditorInput,
  local: ActivityEditorInput,
  latest: ActivityEditorInput,
  choices: Record<string, Choice> = {}
) {
  const conflicts: PlanConflict[] = []
  function pick<T>(
    key: string,
    label: string,
    before: T,
    ours: T,
    theirs: T
  ): T {
    if (same(ours, before)) return theirs
    if (same(theirs, before) || same(ours, theirs)) return ours
    if (!choices[key])
      conflicts.push({ key, label, local: ours, latest: theirs })
    return choices[key] === "latest" ? theirs : ours
  }
  function field<
    K extends Exclude<keyof ActivityEditorInput, "slots" | "version">,
  >(key: K, label: string): ActivityEditorInput[K] {
    return pick(key, label, base[key], local[key], latest[key])
  }
  const ids = new Set(
    [...base.slots, ...local.slots, ...latest.slots].map((slot) => slot.id)
  )
  const slots: ActivityEditorInput["slots"] = []
  for (const id of ids) {
    const before = base.slots.find((slot) => slot.id === id)
    const ours = local.slots.find((slot) => slot.id === id)
    const theirs = latest.slots.find((slot) => slot.id === id)
    if (!before || !ours || !theirs) {
      const value = pick(
        `slot:${id}`,
        "シフトの追加・削除",
        before,
        ours,
        theirs
      )
      if (value) slots.push(value)
      continue
    }
    const memberIds = [
      ...new Set([...before.memberIds, ...ours.memberIds, ...theirs.memberIds]),
    ].filter((memberId) => {
      const previous = before.memberIds.includes(memberId)
      const own = ours.memberIds.includes(memberId)
      return own === previous ? theirs.memberIds.includes(memberId) : own
    })
    slots.push({
      id,
      startsAt: pick(
        `${id}:startsAt`,
        "シフトの開始時刻",
        before.startsAt,
        ours.startsAt,
        theirs.startsAt
      ),
      endsAt: pick(
        `${id}:endsAt`,
        "シフトの終了時刻",
        before.endsAt,
        ours.endsAt,
        theirs.endsAt
      ),
      capacity: pick(
        `${id}:capacity`,
        "人数の目安",
        before.capacity,
        ours.capacity,
        theirs.capacity
      ),
      memberIds,
    })
  }
  const plan: ActivityEditorInput = {
    version: latest.version,
    name: field("name", "名前"),
    place: field("place", "場所"),
    activityType: field("activityType", "種類"),
    startsAt: field("startsAt", "開始日時"),
    endsAt: field("endsAt", "終了日時"),
    color: field("color", "色"),
    notes: field("notes", "備考"),
    active: field("active", "有効・無効"),
    responsibles: field("responsibles", "責任者"),
    candidateRoleIds: field("candidateRoleIds", "候補のロール"),
    slots: slots.sort(
      (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)
    ),
  }
  return { plan, conflicts }
}
