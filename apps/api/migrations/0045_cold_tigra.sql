CREATE TABLE `availability_submission_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`date` text NOT NULL,
	`before_choice` text NOT NULL,
	`before_times` text NOT NULL,
	`after_choice` text NOT NULL,
	`after_times` text NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `availability_changes_submission_changed_idx` ON `availability_submission_changes` (`submission_id`,`changed_at`);