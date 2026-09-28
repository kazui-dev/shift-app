CREATE TABLE `directory_availability_day_answers` (
	`submission_id` text NOT NULL,
	`date_id` text NOT NULL,
	`date_version` integer NOT NULL,
	`choice` text NOT NULL,
	PRIMARY KEY(`submission_id`, `date_id`),
	FOREIGN KEY (`submission_id`) REFERENCES `directory_availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`date_id`) REFERENCES `availability_dates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `directory_availability_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `student_directory`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `directory_availability_submissions_entry_id_unique` ON `directory_availability_submissions` (`entry_id`);--> statement-breakpoint
CREATE TABLE `directory_availability_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`availability_date_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `directory_availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`availability_date_id`) REFERENCES `availability_dates`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "directory_windows_time_order_check" CHECK("directory_availability_windows"."starts_at" < "directory_availability_windows"."ends_at")
);
--> statement-breakpoint
CREATE TABLE `directory_shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `shift_slots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `student_directory`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `directory_assignments_slot_entry_uidx` ON `directory_shift_assignments` (`slot_id`,`entry_id`);--> statement-breakpoint
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

--> statement-breakpoint
DROP TRIGGER members_join_default_year;
--> statement-breakpoint
CREATE TRIGGER members_join_default_year AFTER INSERT ON app_users BEGIN
  INSERT INTO year_memberships (year,member_id,status,created_at,updated_at)
  SELECT default_year, NEW.id, 'active', NEW.created_at, NEW.updated_at FROM year_settings WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM year_memberships WHERE year=default_year AND member_id=NEW.id);
END;
