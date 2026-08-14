CREATE TABLE `assignment_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_reports_assignment_uidx` ON `assignment_reports` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `assignment_reports_status_createdAt_idx` ON `assignment_reports` (`status`,`created_at`);