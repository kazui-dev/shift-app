/** Temporary planning projections for directory-owned work; never used by member/chat lists. */
export const planningMembers = `(SELECT m.id,m.display_name,m.student_id,m.user_id,ym.year
  FROM app_users m JOIN year_memberships ym ON ym.member_id=m.id AND ym.status='active'
  UNION ALL
  SELECT s.id,d.display_name,d.student_id,NULL,d.year
  FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id AND d.status='active')`

export const planningSubmissions = `(SELECT id,year,member_id,status,submitted_at FROM availability_submissions
  UNION ALL
  SELECT s.id,d.year,s.id,CASE WHEN s.submitted_at IS NULL THEN 'draft' ELSE 'submitted' END,s.submitted_at
  FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id AND d.status='active')`
export const planningAnswers = `(SELECT * FROM availability_day_answers UNION ALL SELECT * FROM directory_availability_day_answers)`
export const planningWindows = `(SELECT * FROM availability_windows UNION ALL SELECT * FROM directory_availability_windows)`
/** Submitted responses remain inspectable even after a registered member leaves the year. */
export const planningIdentities = `(SELECT id,display_name,student_id FROM app_users
  UNION ALL SELECT s.id,d.display_name,d.student_id FROM directory_availability_submissions s
  JOIN student_directory d ON d.id=s.entry_id AND d.status='active')`

/** Activity-scoped reads keep slot filtering inside both identity sources. */
export const activityPlanningAssignments = `SELECT a.id,a.slot_id AS slotId,a.member_id AS memberId
  FROM shift_slots s JOIN shift_assignments a ON a.slot_id=s.id AND a.status='active'
  WHERE s.activity_id=?
  UNION ALL
  SELECT a.id,a.slot_id AS slotId,submission.id AS memberId
  FROM shift_slots s JOIN directory_shift_assignments a ON a.slot_id=s.id
  JOIN directory_availability_submissions submission ON submission.entry_id=a.entry_id
  JOIN student_directory directory ON directory.id=submission.entry_id AND directory.status='active'
  WHERE s.activity_id=?`
