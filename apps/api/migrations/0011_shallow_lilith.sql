CREATE TABLE `availability_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "availability_dates_format_check" CHECK("availability_dates"."date" = date("availability_dates"."date"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_dates_year_date_uidx` ON `availability_dates` (`year`,`date`);--> statement-breakpoint
INSERT INTO `availability_dates` (`id`, `year`, `date`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), submission.`year`, date(window.`starts_at` / 1000, 'unixepoch', '+9 hours'), CAST(unixepoch('subsecond') * 1000 AS integer), CAST(unixepoch('subsecond') * 1000 AS integer)
FROM `availability_windows` window
JOIN `availability_submissions` submission ON submission.`id` = window.`submission_id`
GROUP BY submission.`year`, date(window.`starts_at` / 1000, 'unixepoch', '+9 hours');--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_availability_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`availability_date_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`availability_date_id`) REFERENCES `availability_dates`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "availability_windows_time_order_check" CHECK("__new_availability_windows"."starts_at" < "__new_availability_windows"."ends_at")
);--> statement-breakpoint
INSERT INTO `__new_availability_windows` (`id`, `submission_id`, `availability_date_id`, `starts_at`, `ends_at`, `created_at`)
SELECT window.`id`, window.`submission_id`, availability_date.`id`, window.`starts_at`, window.`ends_at`, window.`created_at`
FROM `availability_windows` window
JOIN `availability_submissions` submission ON submission.`id` = window.`submission_id`
JOIN `availability_dates` availability_date
  ON availability_date.`year` = submission.`year`
 AND availability_date.`date` = date(window.`starts_at` / 1000, 'unixepoch', '+9 hours')
WHERE date(window.`starts_at` / 1000, 'unixepoch', '+9 hours') = date(window.`ends_at` / 1000, 'unixepoch', '+9 hours');--> statement-breakpoint
DROP TABLE `availability_windows`;--> statement-breakpoint
ALTER TABLE `__new_availability_windows` RENAME TO `availability_windows`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `availability_windows_submission_startsAt_idx` ON `availability_windows` (`submission_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `availability_windows_date_idx` ON `availability_windows` (`availability_date_id`);
