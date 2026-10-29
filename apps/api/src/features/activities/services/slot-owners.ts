// Include deleted slots: an ID may never move to a different shift.
export const inputSlotOwners = `SELECT id,activity_id AS activityId FROM shift_slots
  WHERE id IN (SELECT value FROM json_each(?))`
