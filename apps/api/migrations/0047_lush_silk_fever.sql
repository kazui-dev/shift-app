CREATE TABLE `directory_availability_submission_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`date` text NOT NULL,
	`before_choice` text NOT NULL,
	`before_times` text NOT NULL,
	`after_choice` text NOT NULL,
	`after_times` text NOT NULL,
	`changed_by` text,
	`changed_by_name` text,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `directory_availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `directory_availability_changes_submission_changed_idx` ON `directory_availability_submission_changes` (`submission_id`,`changed_at`);--> statement-breakpoint
ALTER TABLE `availability_drafts` ADD `revision` integer;--> statement-breakpoint
ALTER TABLE `availability_submission_changes` ADD `changed_by` text;--> statement-breakpoint
ALTER TABLE `availability_submission_changes` ADD `changed_by_name` text;--> statement-breakpoint
ALTER TABLE `directory_availability_submissions` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER directory_availability_revision_guard BEFORE UPDATE OF revision ON directory_availability_submissions
WHEN NEW.revision <> OLD.revision + 1
BEGIN SELECT RAISE(ABORT, 'AVAILABILITY_STALE'); END;
--> statement-breakpoint
CREATE TRIGGER directory_availability_history_on_registration BEFORE DELETE ON directory_availability_submissions
WHEN EXISTS (SELECT 1 FROM availability_submissions WHERE id=OLD.id)
BEGIN
  INSERT INTO availability_submission_changes (id,submission_id,date,before_choice,before_times,after_choice,after_times,changed_by,changed_by_name,changed_at)
    SELECT id,submission_id,date,before_choice,before_times,after_choice,after_times,changed_by,changed_by_name,changed_at FROM directory_availability_submission_changes WHERE submission_id=OLD.id;
END;

--> statement-breakpoint
UPDATE availability_drafts SET revision=COALESCE((SELECT revision FROM availability_submissions WHERE year=availability_drafts.year AND member_id=availability_drafts.member_id),0);
