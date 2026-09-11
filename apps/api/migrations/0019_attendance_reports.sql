CREATE TABLE `attendance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`before` integer,
	`after` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `report_events` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `assignment_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
ALTER TABLE `assignment_reports` ADD `eta` integer;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `status` text DEFAULT 'confirmed' NOT NULL;