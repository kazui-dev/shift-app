CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`published_at` integer NOT NULL,
	`expires_at` integer,
	`created_by` text NOT NULL,
	`archived_by` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`archived_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_year_status_publishedAt_idx` ON `announcements` (`year`,`status`,`published_at`);