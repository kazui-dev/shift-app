import * as v from "valibot"
import { activityEditorInputSchema } from "@workspace/shared/shifts"
import { errors, shiftPlanErrors, type Failure } from "../../../lib/errors"
import { readActivityEditor } from "./activity-editor"
import { validateShiftPlan } from "../../shifts/domain/shift-plan"
import { inputSlotOwners } from "./slot-owners"

export async function prepareActivitySave(
  db: D1Database,
  id: string,
  body: unknown,
  allowOtherOverlap = false
) {
  const failed = (failure: Failure, message = failure.message) => ({
    failure,
    message,
  })
  const parsed = v.safeParse(activityEditorInputSchema, body)
  if (!parsed.success)
    return failed(errors.invalidShift, parsed.issues[0]?.message)
  const current = await readActivityEditor(db, id)
  if (!current) return failed(errors.activityNotFound)
  const input = {
    ...parsed.output,
    requirements:
      body !== null &&
      typeof body === "object" &&
      !Object.hasOwn(body, "requirements")
        ? current.requirements
        : parsed.output.requirements,
    notices: parsed.output.notices ?? current.notices,
  }
  if (current.activity.version !== input.version)
    return failed(errors.shiftStale)
  const checked = validateShiftPlan(
    input,
    current.members.map((member) => member.id),
    allowOtherOverlap ? [] : current.otherAssignments,
    current.availability
  )
  if (checked.error) return failed(shiftPlanErrors[checked.error])
  if (
    input.candidateRoleIds.some(
      (roleId) => !current.roles.some((role) => role.id === roleId)
    )
  )
    return failed(errors.invalidYearRole)
  if (
    input.responsibles.some((target) =>
      target.targetType === "member"
        ? !current.members.some((member) => member.id === target.targetId)
        : !current.roles.some((role) => role.id === target.targetId)
    )
  )
    return failed(errors.invalidResponsible)
  const hasResponsible = current.members.some((member) =>
    input.responsibles.some((target) =>
      target.targetType === "member"
        ? target.targetId === member.id
        : member.roles.some((role) => role.id === target.targetId)
    )
  )
  if (input.active && !hasResponsible) return failed(errors.responsibleRequired)
  const slotIds = await db
    .prepare(inputSlotOwners)
    .bind(JSON.stringify(input.slots.map((slot) => slot.id)))
    .all<{ id: string; activityId: string }>()
  if (
    input.slots.some((slot) =>
      slotIds.results.some(
        (existing) => existing.id === slot.id && existing.activityId !== id
      )
    )
  )
    return failed(errors.slotFromOtherShift)
  return { input, current }
}
