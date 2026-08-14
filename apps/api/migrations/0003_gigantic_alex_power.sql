CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`member_id` text NOT NULL,
	`checked_in_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_records_assignment_uidx` ON `attendance_records` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `attendance_records_member_checkedInAt_idx` ON `attendance_records` (`member_id`,`checked_in_at`);