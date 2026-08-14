CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`place` text NOT NULL,
	`activity_type` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`color` text NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "activities_time_order_check" CHECK("activities"."starts_at" < "activities"."ends_at")
);
--> statement-breakpoint
CREATE INDEX `activities_year_startsAt_idx` ON `activities` (`year`,`starts_at`);--> statement-breakpoint
CREATE TABLE `availability_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_submissions_year_member_uidx` ON `availability_submissions` (`year`,`member_id`);--> statement-breakpoint
CREATE TABLE `availability_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "availability_windows_time_order_check" CHECK("availability_windows"."starts_at" < "availability_windows"."ends_at")
);
--> statement-breakpoint
CREATE INDEX `availability_windows_submission_startsAt_idx` ON `availability_windows` (`submission_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `member_year_roles` (
	`member_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`member_id`, `role_id`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `year_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_year_roles_role_idx` ON `member_year_roles` (`role_id`);--> statement-breakpoint
CREATE TABLE `operating_years` (
	`year` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`member_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`cancelled_by` text,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cancelled_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "shift_assignments_time_order_check" CHECK("shift_assignments"."starts_at" < "shift_assignments"."ends_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shift_assignments_activity_member_time_uidx` ON `shift_assignments` (`activity_id`,`member_id`,`starts_at`,`ends_at`) WHERE "shift_assignments"."status" = 'active';--> statement-breakpoint
CREATE INDEX `shift_assignments_member_startsAt_idx` ON `shift_assignments` (`member_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `year_role_permissions` (
	`role_id` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`role_id`, `permission`),
	FOREIGN KEY (`role_id`) REFERENCES `year_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `year_role_permissions_permission_idx` ON `year_role_permissions` (`permission`);--> statement-breakpoint
CREATE TABLE `year_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `year_roles_year_name_nocase_uidx` ON `year_roles` (`year`,lower("name"));