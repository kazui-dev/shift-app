// Count each source from the activity slots; do not scan a combined assignment projection.
export const activityListSelection = `SELECT
         activity.id,
         activity.year,
         activity.name,
         activity.active,
         activity.version,
         activity.place,
         activity.activity_type AS activityType,
         activity.starts_at AS startsAt,
         activity.ends_at AS endsAt,
         activity.color,
         activity.notes,
         ((SELECT COUNT(*) FROM shift_slots slot
          JOIN shift_assignments assignment ON assignment.slot_id=slot.id AND assignment.status='active'
          WHERE slot.activity_id=activity.id)
          + (SELECT COUNT(*) FROM shift_slots slot
          JOIN directory_shift_assignments assignment ON assignment.slot_id=slot.id
          JOIN directory_availability_submissions submission ON submission.entry_id=assignment.entry_id
          JOIN student_directory directory ON directory.id=submission.entry_id AND directory.status='active'
          WHERE slot.activity_id=activity.id)) AS assignmentCount
       FROM activities activity
       WHERE activity.year = ? AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activity.id AND r.member_id=?) OR (activity.created_by=? AND activity.active=0))
       ORDER BY activity.starts_at, activity.ends_at, lower(activity.name)`
