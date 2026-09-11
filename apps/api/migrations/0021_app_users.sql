-- SQLite updates foreign keys, views and triggers during a table rename.
-- Do not rebuild parent or dependent tables: that would destroy historical rows.
ALTER TABLE members RENAME TO app_users;
--> statement-breakpoint
DROP INDEX members_userId_uidx;
--> statement-breakpoint
DROP INDEX members_studentId_nocase_uidx;
--> statement-breakpoint
CREATE UNIQUE INDEX app_users_userId_uidx ON app_users(user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX app_users_studentId_nocase_uidx ON app_users(lower(student_id));
--> statement-breakpoint
CREATE TRIGGER membership_future_shifts BEFORE UPDATE OF status ON year_memberships
WHEN NEW.status='inactive' AND EXISTS (
 SELECT 1 FROM shift_assignments assignment JOIN shift_slots slot ON slot.id=assignment.slot_id JOIN activities activity ON activity.id=slot.activity_id
 WHERE assignment.member_id=NEW.member_id AND activity.year=NEW.year AND assignment.status='active' AND slot.ends_at>CAST(unixepoch('subsecond')*1000 AS INTEGER))
BEGIN SELECT RAISE(ABORT,'FUTURE_SHIFTS'); END;
