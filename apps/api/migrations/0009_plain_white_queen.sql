CREATE TABLE `year_memberships` (
	`year` integer NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`year`, `member_id`),
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `year_memberships_member_status_idx` ON `year_memberships` (`member_id`,`status`,`year`);
--> statement-breakpoint
INSERT INTO `year_memberships` (`year`, `member_id`, `status`, `created_at`, `updated_at`)
SELECT operating_year.year, member.id, 'active',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `operating_years` operating_year
CROSS JOIN `members` member;
