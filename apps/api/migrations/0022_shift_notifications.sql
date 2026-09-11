CREATE TABLE `activity_notifications` (
	`activity_id` text NOT NULL,
	`member_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`activity_id`, `member_id`, `version`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
