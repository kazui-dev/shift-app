/** Temporary planning projections for directory-owned work; never used by member/chat lists. */
export const planningMembers = `(SELECT m.id,m.display_name,m.student_id,m.user_id,ym.year
  FROM app_users m JOIN year_memberships ym ON ym.member_id=m.id AND ym.status='active'
  UNION ALL
  SELECT s.id,d.display_name,d.student_id,NULL,d.year
  FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id)`

export const planningRoles = `(SELECT member_id,role_id FROM member_year_roles
  UNION
  SELECT s.id,b.role_id FROM directory_availability_submissions s
  JOIN student_directory d ON d.id=s.entry_id JOIN bureaus b ON b.id=d.bureau_id WHERE b.role_id IS NOT NULL
  UNION
  SELECT s.id,duty.role_id FROM directory_availability_submissions s
  JOIN student_directory d ON d.id=s.entry_id JOIN directory_duties dd ON dd.entry_id=d.id
  JOIN duties duty ON duty.id=dd.duty_id WHERE duty.role_id IS NOT NULL)`

export const planningSubmissions = `(SELECT id,year,member_id,status,submitted_at FROM availability_submissions
  UNION ALL
  SELECT s.id,d.year,s.id,CASE WHEN s.submitted_at IS NULL THEN 'draft' ELSE 'submitted' END,s.submitted_at
  FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id)`
export const planningAnswers = `(SELECT * FROM availability_day_answers UNION ALL SELECT * FROM directory_availability_day_answers)`
export const planningWindows = `(SELECT * FROM availability_windows UNION ALL SELECT * FROM directory_availability_windows)`
export const planningAssignments = `(SELECT id,slot_id,member_id,status FROM shift_assignments
  UNION ALL SELECT a.id,a.slot_id,s.id,'active' FROM directory_shift_assignments a
  JOIN directory_availability_submissions s ON s.entry_id=a.entry_id)`

/** Submitted responses remain inspectable even after a registered member leaves the year. */
export const planningIdentities = `(SELECT id,display_name,student_id FROM app_users
  UNION ALL SELECT s.id,d.display_name,d.student_id FROM directory_availability_submissions s
  JOIN student_directory d ON d.id=s.entry_id)`
