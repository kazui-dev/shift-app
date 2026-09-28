-- Apply only after directory-owned work has been moved out of unregistered app_users.
-- NOT NULL below aborts the migration if any unregistered member remains.
DROP TRIGGER directory_work_on_registration;
--> statement-breakpoint
DROP TRIGGER directory_assignment_check;
--> statement-breakpoint
DROP TRIGGER directory_slot_overlap;
--> statement-breakpoint
CREATE TABLE __registered_directory_assignments AS SELECT * FROM directory_shift_assignments;
--> statement-breakpoint
DELETE FROM directory_shift_assignments;
--> statement-breakpoint
-- Keep foreign keys enabled. Copy dependent rows within this migration,
-- then restore them before it finishes: dropping app_users must not cascade
-- into availability, memberships, assignments, chat or audit history.
--> statement-breakpoint
DROP VIEW `activity_effective_responsibles`;
--> statement-breakpoint
DROP TRIGGER `operating_years_initialize_default`;
--> statement-breakpoint
DROP TRIGGER `year_settings_prevent_delete`;
--> statement-breakpoint
DROP TRIGGER `members_join_default_year`;
--> statement-breakpoint
DROP TRIGGER `shift_assignment_overlap_insert`;
--> statement-breakpoint
DROP TRIGGER `shift_assignment_overlap_update`;
--> statement-breakpoint
DROP TRIGGER `shift_slot_overlap_update`;
--> statement-breakpoint
DROP TRIGGER `activities_require_responsible`;
--> statement-breakpoint
DROP TRIGGER `activities_create_inactive`;
--> statement-breakpoint
DROP TRIGGER `slots_require_owner`;
--> statement-breakpoint
DROP TRIGGER `assignments_require_membership`;
--> statement-breakpoint
DROP TRIGGER `assignments_update_require_membership`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_activity_responsibles_delete`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_activity_responsibles_update`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_year_memberships_delete`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_year_memberships_update`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_member_year_roles_delete`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_member_year_roles_update`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_year_roles_delete`;
--> statement-breakpoint
DROP TRIGGER `responsible_loss_year_roles_update`;
--> statement-breakpoint
DROP TRIGGER `membership_future_shifts`;
--> statement-breakpoint
CREATE TABLE `__registered_activities` AS SELECT * FROM `activities`;
--> statement-breakpoint
CREATE TABLE `__registered_activity_history` AS SELECT * FROM `activity_history`;
--> statement-breakpoint
CREATE TABLE `__registered_admin_audit_logs` AS SELECT * FROM `admin_audit_logs`;
--> statement-breakpoint
CREATE TABLE `__registered_availability_drafts` AS SELECT * FROM `availability_drafts`;
--> statement-breakpoint
CREATE TABLE `__registered_availability_submissions` AS SELECT * FROM `availability_submissions`;
--> statement-breakpoint
CREATE TABLE `__registered_chat_rooms` AS SELECT * FROM `chat_rooms`;
--> statement-breakpoint
CREATE TABLE `__registered_identity_link_requests` AS SELECT * FROM `identity_link_requests`;
--> statement-breakpoint
CREATE TABLE `__registered_member_year_roles` AS SELECT * FROM `member_year_roles`;
--> statement-breakpoint
CREATE TABLE `__registered_notification_devices` AS SELECT * FROM `notification_devices`;
--> statement-breakpoint
CREATE TABLE `__registered_user_preferences` AS SELECT * FROM `user_preferences`;
--> statement-breakpoint
CREATE TABLE `__registered_year_memberships` AS SELECT * FROM `year_memberships`;
--> statement-breakpoint
CREATE TABLE `__registered_activity_candidate_roles` AS SELECT * FROM `activity_candidate_roles`;
--> statement-breakpoint
CREATE TABLE `__registered_activity_chat_rooms` AS SELECT * FROM `activity_chat_rooms`;
--> statement-breakpoint
CREATE TABLE `__registered_activity_notifications` AS SELECT * FROM `activity_notifications`;
--> statement-breakpoint
CREATE TABLE `__registered_activity_responsibles` AS SELECT * FROM `activity_responsibles`;
--> statement-breakpoint
CREATE TABLE `__registered_availability_day_answers` AS SELECT * FROM `availability_day_answers`;
--> statement-breakpoint
CREATE TABLE `__registered_availability_windows` AS SELECT * FROM `availability_windows`;
--> statement-breakpoint
CREATE TABLE `__registered_chat_message_index` AS SELECT * FROM `chat_message_index`;
--> statement-breakpoint
CREATE TABLE `__registered_chat_room_bots` AS SELECT * FROM `chat_room_bots`;
--> statement-breakpoint
CREATE TABLE `__registered_chat_room_exits` AS SELECT * FROM `chat_room_exits`;
--> statement-breakpoint
CREATE TABLE `__registered_chat_room_preferences` AS SELECT * FROM `chat_room_preferences`;
--> statement-breakpoint
CREATE TABLE `__registered_chat_room_targets` AS SELECT * FROM `chat_room_targets`;
--> statement-breakpoint
CREATE TABLE `__registered_shift_slots` AS SELECT * FROM `shift_slots`;
--> statement-breakpoint
CREATE TABLE `__registered_shift_assignments` AS SELECT * FROM `shift_assignments`;
--> statement-breakpoint
CREATE TABLE `__registered_assignment_attendance` AS SELECT * FROM `assignment_attendance`;
--> statement-breakpoint
CREATE TABLE `__registered_assignment_attendance_events` AS SELECT * FROM `assignment_attendance_events`;
--> statement-breakpoint
CREATE TABLE `__registered_notification_deliveries` AS SELECT * FROM `notification_deliveries`;
--> statement-breakpoint
CREATE TABLE `__new_app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`student_id` text NOT NULL,
	`access_level` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO __new_app_users SELECT * FROM app_users;
--> statement-breakpoint
DELETE FROM `notification_deliveries`;
--> statement-breakpoint
DELETE FROM `assignment_attendance_events`;
--> statement-breakpoint
DELETE FROM `assignment_attendance`;
--> statement-breakpoint
DELETE FROM `shift_assignments`;
--> statement-breakpoint
DELETE FROM `shift_slots`;
--> statement-breakpoint
DELETE FROM `chat_room_targets`;
--> statement-breakpoint
DELETE FROM `chat_room_preferences`;
--> statement-breakpoint
DELETE FROM `chat_room_exits`;
--> statement-breakpoint
DELETE FROM `chat_room_bots`;
--> statement-breakpoint
DELETE FROM `chat_message_index`;
--> statement-breakpoint
DELETE FROM `availability_windows`;
--> statement-breakpoint
DELETE FROM `availability_day_answers`;
--> statement-breakpoint
DELETE FROM `activity_responsibles`;
--> statement-breakpoint
DELETE FROM `activity_notifications`;
--> statement-breakpoint
DELETE FROM `activity_chat_rooms`;
--> statement-breakpoint
DELETE FROM `activity_candidate_roles`;
--> statement-breakpoint
DELETE FROM `year_memberships`;
--> statement-breakpoint
DELETE FROM `user_preferences`;
--> statement-breakpoint
DELETE FROM `notification_devices`;
--> statement-breakpoint
DELETE FROM `member_year_roles`;
--> statement-breakpoint
DELETE FROM `identity_link_requests`;
--> statement-breakpoint
DELETE FROM `chat_rooms`;
--> statement-breakpoint
DELETE FROM `availability_submissions`;
--> statement-breakpoint
DELETE FROM `availability_drafts`;
--> statement-breakpoint
DELETE FROM `admin_audit_logs`;
--> statement-breakpoint
DELETE FROM `activity_history`;
--> statement-breakpoint
DELETE FROM `activities`;
--> statement-breakpoint
DROP TABLE app_users;
--> statement-breakpoint
ALTER TABLE __new_app_users RENAME TO app_users;
--> statement-breakpoint
CREATE UNIQUE INDEX app_users_userId_uidx ON app_users(user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX app_users_studentId_nocase_uidx ON app_users(lower(student_id));
--> statement-breakpoint
INSERT INTO `activities` SELECT * FROM `__registered_activities`;
--> statement-breakpoint
INSERT INTO `activity_history` SELECT * FROM `__registered_activity_history`;
--> statement-breakpoint
INSERT INTO `admin_audit_logs` SELECT * FROM `__registered_admin_audit_logs`;
--> statement-breakpoint
INSERT INTO `availability_drafts` SELECT * FROM `__registered_availability_drafts`;
--> statement-breakpoint
INSERT INTO `availability_submissions` SELECT * FROM `__registered_availability_submissions`;
--> statement-breakpoint
INSERT INTO `chat_rooms` SELECT * FROM `__registered_chat_rooms`;
--> statement-breakpoint
INSERT INTO `identity_link_requests` SELECT * FROM `__registered_identity_link_requests`;
--> statement-breakpoint
INSERT INTO `member_year_roles` SELECT * FROM `__registered_member_year_roles`;
--> statement-breakpoint
INSERT INTO `notification_devices` SELECT * FROM `__registered_notification_devices`;
--> statement-breakpoint
INSERT INTO `user_preferences` SELECT * FROM `__registered_user_preferences`;
--> statement-breakpoint
INSERT INTO `year_memberships` SELECT * FROM `__registered_year_memberships`;
--> statement-breakpoint
INSERT INTO `activity_candidate_roles` SELECT * FROM `__registered_activity_candidate_roles`;
--> statement-breakpoint
INSERT INTO `activity_chat_rooms` SELECT * FROM `__registered_activity_chat_rooms`;
--> statement-breakpoint
INSERT INTO `activity_notifications` SELECT * FROM `__registered_activity_notifications`;
--> statement-breakpoint
INSERT INTO `activity_responsibles` SELECT * FROM `__registered_activity_responsibles`;
--> statement-breakpoint
INSERT INTO `availability_day_answers` SELECT * FROM `__registered_availability_day_answers`;
--> statement-breakpoint
INSERT INTO `availability_windows` SELECT * FROM `__registered_availability_windows`;
--> statement-breakpoint
INSERT INTO `chat_message_index` SELECT * FROM `__registered_chat_message_index`;
--> statement-breakpoint
INSERT INTO `chat_room_bots` SELECT * FROM `__registered_chat_room_bots`;
--> statement-breakpoint
INSERT INTO `chat_room_exits` SELECT * FROM `__registered_chat_room_exits`;
--> statement-breakpoint
INSERT INTO `chat_room_preferences` SELECT * FROM `__registered_chat_room_preferences`;
--> statement-breakpoint
INSERT INTO `chat_room_targets` SELECT * FROM `__registered_chat_room_targets`;
--> statement-breakpoint
INSERT INTO `shift_slots` SELECT * FROM `__registered_shift_slots`;
--> statement-breakpoint
INSERT INTO `shift_assignments` SELECT * FROM `__registered_shift_assignments`;
--> statement-breakpoint
INSERT INTO `assignment_attendance` SELECT * FROM `__registered_assignment_attendance`;
--> statement-breakpoint
INSERT INTO `assignment_attendance_events` SELECT * FROM `__registered_assignment_attendance_events`;
--> statement-breakpoint
INSERT INTO `notification_deliveries` SELECT * FROM `__registered_notification_deliveries`;
--> statement-breakpoint
DROP TABLE `__registered_activities`;
--> statement-breakpoint
DROP TABLE `__registered_activity_history`;
--> statement-breakpoint
DROP TABLE `__registered_admin_audit_logs`;
--> statement-breakpoint
DROP TABLE `__registered_availability_drafts`;
--> statement-breakpoint
DROP TABLE `__registered_availability_submissions`;
--> statement-breakpoint
DROP TABLE `__registered_chat_rooms`;
--> statement-breakpoint
DROP TABLE `__registered_identity_link_requests`;
--> statement-breakpoint
DROP TABLE `__registered_member_year_roles`;
--> statement-breakpoint
DROP TABLE `__registered_notification_devices`;
--> statement-breakpoint
DROP TABLE `__registered_user_preferences`;
--> statement-breakpoint
DROP TABLE `__registered_year_memberships`;
--> statement-breakpoint
DROP TABLE `__registered_activity_candidate_roles`;
--> statement-breakpoint
DROP TABLE `__registered_activity_chat_rooms`;
--> statement-breakpoint
DROP TABLE `__registered_activity_notifications`;
--> statement-breakpoint
DROP TABLE `__registered_activity_responsibles`;
--> statement-breakpoint
DROP TABLE `__registered_availability_day_answers`;
--> statement-breakpoint
DROP TABLE `__registered_availability_windows`;
--> statement-breakpoint
DROP TABLE `__registered_chat_message_index`;
--> statement-breakpoint
DROP TABLE `__registered_chat_room_bots`;
--> statement-breakpoint
DROP TABLE `__registered_chat_room_exits`;
--> statement-breakpoint
DROP TABLE `__registered_chat_room_preferences`;
--> statement-breakpoint
DROP TABLE `__registered_chat_room_targets`;
--> statement-breakpoint
DROP TABLE `__registered_shift_slots`;
--> statement-breakpoint
DROP TABLE `__registered_shift_assignments`;
--> statement-breakpoint
DROP TABLE `__registered_assignment_attendance`;
--> statement-breakpoint
DROP TABLE `__registered_assignment_attendance_events`;
--> statement-breakpoint
DROP TABLE `__registered_notification_deliveries`;
--> statement-breakpoint
CREATE VIEW activity_effective_responsibles AS
SELECT DISTINCT r.activity_id, ym.member_id FROM activity_responsibles r
JOIN activities a ON a.id=r.activity_id
JOIN year_memberships ym ON ym.year=a.year AND ym.status='active'
WHERE (r.target_type='member' AND r.target_id=ym.member_id)
OR (r.target_type='role' AND EXISTS (SELECT 1 FROM member_year_roles mr JOIN year_roles role ON role.id=mr.role_id WHERE mr.member_id=ym.member_id AND mr.role_id=r.target_id AND role.year=a.year));
--> statement-breakpoint
CREATE TRIGGER operating_years_initialize_default
AFTER INSERT ON operating_years
WHEN NOT EXISTS (SELECT 1 FROM year_settings)
BEGIN
  INSERT INTO year_settings (id, default_year) VALUES (1, NEW.year);
END;
--> statement-breakpoint
CREATE TRIGGER year_settings_prevent_delete
BEFORE DELETE ON year_settings
BEGIN
  SELECT RAISE(ABORT, 'A default year is required');
END;
--> statement-breakpoint
CREATE TRIGGER members_join_default_year AFTER INSERT ON "app_users"
BEGIN
  INSERT INTO year_memberships (year, member_id, status, created_at, updated_at)
  SELECT default_year, NEW.id, 'active', NEW.created_at, NEW.updated_at FROM year_settings WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM year_memberships WHERE year=default_year AND member_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER shift_assignment_overlap_insert BEFORE INSERT ON shift_assignments WHEN NEW.status = 'active'
BEGIN
 SELECT RAISE(ABORT, 'SHIFT_OVERLAP') WHERE EXISTS (
   SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN shift_slots n ON n.id = NEW.slot_id
   WHERE a.member_id = NEW.member_id AND a.status = 'active' AND s.starts_at < n.ends_at AND s.ends_at > n.starts_at
 );
END;
--> statement-breakpoint
CREATE TRIGGER shift_assignment_overlap_update BEFORE UPDATE OF slot_id, member_id, status ON shift_assignments WHEN NEW.status = 'active'
BEGIN
 SELECT RAISE(ABORT, 'SHIFT_OVERLAP') WHERE EXISTS (
   SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN shift_slots n ON n.id = NEW.slot_id
   WHERE a.id <> NEW.id AND a.member_id = NEW.member_id AND a.status = 'active' AND s.starts_at < n.ends_at AND s.ends_at > n.starts_at
 );
END;
--> statement-breakpoint
CREATE TRIGGER shift_slot_overlap_update BEFORE UPDATE OF starts_at, ends_at ON shift_slots
BEGIN
  SELECT RAISE(ABORT, 'SHIFT_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM shift_assignments own JOIN shift_assignments other ON other.member_id=own.member_id AND other.id<>own.id AND other.status='active'
    JOIN shift_slots s ON s.id=other.slot_id
    WHERE own.slot_id=NEW.id AND own.status='active' AND s.starts_at<NEW.ends_at AND s.ends_at>NEW.starts_at
  );
END;
--> statement-breakpoint
CREATE TRIGGER activities_require_responsible BEFORE UPDATE OF active ON activities
WHEN NEW.active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'RESPONSIBLE_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER activities_create_inactive BEFORE INSERT ON activities WHEN NEW.active=1
BEGIN SELECT RAISE(ABORT,'RESPONSIBLE_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER slots_require_owner BEFORE UPDATE OF activity_id ON shift_slots WHEN NEW.activity_id<>OLD.activity_id
BEGIN SELECT RAISE(ABORT,'INVALID_SLOT'); END;
--> statement-breakpoint
CREATE TRIGGER assignments_require_membership BEFORE INSERT ON shift_assignments WHEN NEW.status='active' AND NOT EXISTS (
 SELECT 1 FROM shift_slots s JOIN activities a ON a.id=s.activity_id JOIN year_memberships ym ON ym.year=a.year AND ym.member_id=NEW.member_id AND ym.status='active' WHERE s.id=NEW.slot_id AND s.deleted=0)
BEGIN SELECT RAISE(ABORT,'YEAR_MEMBERSHIP_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER assignments_update_require_membership BEFORE UPDATE ON shift_assignments WHEN NEW.status='active' AND NOT EXISTS (
 SELECT 1 FROM shift_slots s JOIN activities a ON a.id=s.activity_id JOIN year_memberships ym ON ym.year=a.year AND ym.member_id=NEW.member_id AND ym.status='active' WHERE s.id=NEW.slot_id AND s.deleted=0)
BEGIN SELECT RAISE(ABORT,'YEAR_MEMBERSHIP_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_activity_responsibles_delete AFTER DELETE ON activity_responsibles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_activity_responsibles_update AFTER UPDATE ON activity_responsibles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_memberships_delete AFTER DELETE ON year_memberships BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_memberships_update AFTER UPDATE ON year_memberships BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_member_year_roles_delete AFTER DELETE ON member_year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_member_year_roles_update AFTER UPDATE ON member_year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_roles_delete AFTER DELETE ON year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_roles_update AFTER UPDATE ON year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER membership_future_shifts BEFORE UPDATE OF status ON year_memberships
WHEN NEW.status='inactive' AND EXISTS (
 SELECT 1 FROM shift_assignments assignment JOIN shift_slots slot ON slot.id=assignment.slot_id JOIN activities activity ON activity.id=slot.activity_id
 WHERE assignment.member_id=NEW.member_id AND activity.year=NEW.year AND assignment.status='active' AND slot.ends_at>CAST(unixepoch('subsecond')*1000 AS INTEGER))
BEGIN SELECT RAISE(ABORT,'FUTURE_SHIFTS'); END;

--> statement-breakpoint
INSERT INTO directory_shift_assignments SELECT * FROM __registered_directory_assignments;
--> statement-breakpoint
DROP TABLE __registered_directory_assignments;
--> statement-breakpoint
-- A verified first sign-in creates the member normally. Move directory-owned
-- work in the same insert transaction, for either authentication provider.
CREATE TRIGGER directory_work_on_registration AFTER INSERT ON app_users
WHEN NEW.user_id IS NOT NULL BEGIN
  INSERT OR IGNORE INTO year_memberships (year,member_id,status,created_at,updated_at)
    SELECT d.year,NEW.id,'active',NEW.created_at,NEW.updated_at
    FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id
    WHERE upper(d.student_id)=upper(NEW.student_id);
  INSERT INTO availability_submissions (id,year,member_id,status,submitted_at,created_at,updated_at)
    SELECT s.id,d.year,NEW.id,'submitted',s.submitted_at,s.created_at,s.updated_at
    FROM directory_availability_submissions s JOIN student_directory d ON d.id=s.entry_id
    WHERE upper(d.student_id)=upper(NEW.student_id) AND s.submitted_at IS NOT NULL;
  INSERT INTO availability_day_answers SELECT a.* FROM directory_availability_day_answers a
    JOIN availability_submissions s ON s.id=a.submission_id WHERE s.member_id=NEW.id;
  INSERT INTO availability_windows SELECT w.* FROM directory_availability_windows w
    JOIN availability_submissions s ON s.id=w.submission_id WHERE s.member_id=NEW.id;
  UPDATE activities SET version=version+1 WHERE year IN (
    SELECT d.year FROM directory_availability_submissions survey
    JOIN student_directory d ON d.id=survey.entry_id WHERE upper(d.student_id)=upper(NEW.student_id));
  INSERT INTO shift_assignments (id,slot_id,member_id,status,created_by,created_at,updated_at)
    SELECT a.id,a.slot_id,NEW.id,'active',a.created_by,a.created_at,a.updated_at
    FROM directory_shift_assignments a JOIN student_directory d ON d.id=a.entry_id
    WHERE upper(d.student_id)=upper(NEW.student_id);
  DELETE FROM directory_shift_assignments WHERE entry_id IN (SELECT id FROM student_directory WHERE upper(student_id)=upper(NEW.student_id));
  DELETE FROM directory_availability_submissions WHERE entry_id IN (SELECT id FROM student_directory WHERE upper(student_id)=upper(NEW.student_id));
END;
--> statement-breakpoint
CREATE TRIGGER directory_assignment_check BEFORE INSERT ON directory_shift_assignments BEGIN
  SELECT RAISE(ABORT,'YEAR_MEMBERSHIP_REQUIRED') WHERE NOT EXISTS (
    SELECT 1 FROM directory_availability_submissions survey JOIN student_directory d ON d.id=survey.entry_id
    JOIN shift_slots slot ON slot.id=NEW.slot_id JOIN activities activity ON activity.id=slot.activity_id
    WHERE d.id=NEW.entry_id AND d.year=activity.year AND slot.deleted=0
    AND NOT EXISTS (SELECT 1 FROM app_users m WHERE upper(m.student_id)=upper(d.student_id)));
  SELECT RAISE(ABORT,'SHIFT_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM directory_shift_assignments a JOIN shift_slots s ON s.id=a.slot_id
    JOIN shift_slots target ON target.id=NEW.slot_id
    WHERE a.entry_id=NEW.entry_id AND a.id<>NEW.id AND s.deleted=0
      AND s.starts_at<target.ends_at AND target.starts_at<s.ends_at);
END;
--> statement-breakpoint
CREATE TRIGGER directory_slot_overlap BEFORE UPDATE OF starts_at,ends_at ON shift_slots BEGIN
  SELECT RAISE(ABORT,'SHIFT_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM directory_shift_assignments own JOIN directory_shift_assignments other ON other.entry_id=own.entry_id AND other.slot_id<>own.slot_id
    JOIN shift_slots s ON s.id=other.slot_id
    WHERE own.slot_id=NEW.id AND s.deleted=0 AND NEW.deleted=0 AND s.starts_at<NEW.ends_at AND NEW.starts_at<s.ends_at);
END;
