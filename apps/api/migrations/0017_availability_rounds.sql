CREATE TABLE `availability_day_answers` (
	`submission_id` text NOT NULL,
	`date_id` text NOT NULL,
	`date_version` integer NOT NULL,
	`choice` text NOT NULL,
	PRIMARY KEY(`submission_id`, `date_id`),
	FOREIGN KEY (`submission_id`) REFERENCES `availability_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`date_id`) REFERENCES `availability_dates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `availability_drafts` (
	`year` integer NOT NULL,
	`member_id` text NOT NULL,
	`answers` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`year`, `member_id`),
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `availability_dates` ADD `starts_minute` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `availability_dates` ADD `ends_minute` integer DEFAULT 1440 NOT NULL;--> statement-breakpoint
ALTER TABLE `availability_dates` ADD `accepting` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `availability_dates` ADD `deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `availability_dates` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
INSERT INTO availability_day_answers (submission_id,date_id,date_version,choice)
SELECT s.id,d.id,1,CASE WHEN EXISTS (SELECT 1 FROM availability_windows w WHERE w.submission_id=s.id AND w.availability_date_id=d.id) THEN 'times' ELSE 'no' END
FROM availability_submissions s JOIN availability_dates d ON d.year=s.year WHERE s.status='submitted';
