ALTER TABLE `student_directory` ADD `status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
DROP TRIGGER members_join_default_year;
--> statement-breakpoint
CREATE TRIGGER members_join_default_year AFTER INSERT ON app_users
BEGIN
  INSERT INTO year_memberships (year, member_id, status, created_at, updated_at)
  SELECT default_year, NEW.id, 'active', NEW.created_at, NEW.updated_at FROM year_settings
  WHERE id=1
    AND NOT EXISTS (SELECT 1 FROM year_memberships WHERE year=default_year AND member_id=NEW.id)
    AND NOT EXISTS (SELECT 1 FROM student_directory d WHERE d.year=default_year AND upper(d.student_id)=upper(NEW.student_id) AND d.status='inactive');
END;
--> statement-breakpoint
-- A removed listing keeps its survey record but cannot grant access or
-- transfer the survey to a later account with the same student ID.
DROP TRIGGER directory_work_on_registration;
--> statement-breakpoint
CREATE TRIGGER directory_work_on_registration AFTER INSERT ON app_users
WHEN NEW.user_id IS NOT NULL BEGIN
  INSERT OR IGNORE INTO year_memberships (year,member_id,status,created_at,updated_at)
    SELECT d.year,NEW.id,'active',NEW.created_at,NEW.updated_at
    FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id
    WHERE upper(d.student_id)=upper(NEW.student_id) AND d.status='active';
  INSERT INTO availability_submissions (id,year,member_id,status,submitted_at,created_at,updated_at)
    SELECT s.id,d.year,NEW.id,'submitted',s.submitted_at,s.created_at,s.updated_at
    FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id
    WHERE upper(d.student_id)=upper(NEW.student_id) AND d.status='active' AND s.submitted_at IS NOT NULL;
  INSERT INTO availability_day_answers SELECT a.* FROM directory_availability_day_answers a
    JOIN availability_submissions s ON s.id=a.submission_id WHERE s.member_id=NEW.id;
  INSERT INTO availability_windows SELECT w.* FROM directory_availability_windows w
    JOIN availability_submissions s ON s.id=w.submission_id WHERE s.member_id=NEW.id;
  UPDATE activities SET version=version+1 WHERE year IN (
    SELECT d.year FROM directory_availability_submissions survey
    JOIN student_directory d ON d.id=survey.entry_id WHERE upper(d.student_id)=upper(NEW.student_id) AND d.status='active');
  INSERT INTO shift_assignments (id,slot_id,member_id,status,created_by,created_at,updated_at)
    SELECT a.id,a.slot_id,NEW.id,'active',a.created_by,a.created_at,a.updated_at
    FROM directory_shift_assignments a JOIN student_directory d ON d.id=a.entry_id
    WHERE upper(d.student_id)=upper(NEW.student_id) AND d.status='active';
  DELETE FROM directory_shift_assignments WHERE entry_id IN (SELECT id FROM student_directory WHERE upper(student_id)=upper(NEW.student_id) AND status='active');
  DELETE FROM directory_availability_submissions WHERE entry_id IN (SELECT id FROM student_directory WHERE upper(student_id)=upper(NEW.student_id) AND status='active');
END;
--> statement-breakpoint
DROP TRIGGER directory_assignment_check;
--> statement-breakpoint
CREATE TRIGGER directory_assignment_check BEFORE INSERT ON directory_shift_assignments BEGIN
  SELECT RAISE(ABORT,'YEAR_MEMBERSHIP_REQUIRED') WHERE NOT EXISTS (
    SELECT 1 FROM directory_availability_submissions survey JOIN student_directory d ON d.id=survey.entry_id
    JOIN shift_slots slot ON slot.id=NEW.slot_id JOIN activities activity ON activity.id=slot.activity_id
    WHERE d.id=NEW.entry_id AND d.status='active' AND d.year=activity.year AND slot.deleted=0
    AND NOT EXISTS (SELECT 1 FROM app_users m WHERE upper(m.student_id)=upper(d.student_id)));
  SELECT RAISE(ABORT,'SHIFT_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM directory_shift_assignments a JOIN shift_slots s ON s.id=a.slot_id
    JOIN shift_slots target ON target.id=NEW.slot_id
    WHERE a.entry_id=NEW.entry_id AND a.id<>NEW.id AND s.deleted=0
      AND s.starts_at<target.ends_at AND target.starts_at<s.ends_at);
END;
--> statement-breakpoint
CREATE TRIGGER directory_deactivation_check BEFORE UPDATE OF status ON student_directory
WHEN NEW.status='inactive' AND OLD.status<>'inactive' AND EXISTS (
  SELECT 1 FROM directory_shift_assignments WHERE entry_id=OLD.id
)
BEGIN SELECT RAISE(ABORT,'DIRECTORY_ASSIGNMENTS_EXIST'); END;
