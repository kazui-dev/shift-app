CREATE TABLE `attendance_notice_members` (
	`year` integer NOT NULL,
	`member_id` text NOT NULL,
	PRIMARY KEY(`year`, `member_id`),
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attendance_notice_roles` (
	`year` integer NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`year`, `role_id`),
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `year_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `year_attendance_settings` (
	`year` integer PRIMARY KEY NOT NULL,
	`notice_audience` text DEFAULT 'selected' NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade
);
