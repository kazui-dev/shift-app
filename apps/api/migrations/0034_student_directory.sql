CREATE TABLE `student_directory` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`student_id` text NOT NULL,
	`display_name` text NOT NULL,
	`bureau` text,
	`duty` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_directory_year_studentId_nocase_uidx` ON `student_directory` (`year`,lower("student_id"));