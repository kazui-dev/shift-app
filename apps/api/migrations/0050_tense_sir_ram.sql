CREATE TABLE `activity_notices` (
	`activity_id` text NOT NULL,
	`id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`activity_id`, `id`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "activity_notices_time_check" CHECK("activity_notices"."starts_at" < "activity_notices"."ends_at"),
	CONSTRAINT "activity_notices_content_check" CHECK(length(trim("activity_notices"."content")) BETWEEN 1 AND 2000)
);
