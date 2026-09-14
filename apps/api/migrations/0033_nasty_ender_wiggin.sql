CREATE TABLE `assignment_attendance` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`state` text NOT NULL,
	`expected_at` integer,
	`reason` text DEFAULT '' NOT NULL,
	`checked_in_at` integer,
	`check_in_status` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assignment_attendance_member_state_idx` ON `assignment_attendance` (`member_id`,`state`);--> statement-breakpoint
CREATE TABLE `assignment_attendance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`expected_at` integer,
	`checked_in_at` integer,
	`previous_checked_in_at` integer,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `assignment_attendance_events_assignment_idx` ON `assignment_attendance_events` (`assignment_id`,`created_at`);--> statement-breakpoint
-- A check-in wins over a late or absence report for the same assignment; a taken-back report is not carried over.
INSERT INTO `assignment_attendance` (`assignment_id`,`member_id`,`state`,`expected_at`,`reason`,`checked_in_at`,`check_in_status`,`resolved_by`,`resolved_at`,`created_at`,`updated_at`)
SELECT a.`id`, a.`member_id`,
  CASE WHEN ar.`id` IS NOT NULL THEN 'present' WHEN r.`kind` = 'absence' THEN 'absent' ELSE 'late' END,
  CASE WHEN r.`kind` = 'late' THEN r.`eta` END,
  COALESCE(r.`message`, ''),
  ar.`checked_in_at`, ar.`status`,
  CASE WHEN ar.`id` IS NULL THEN r.`resolved_by` END,
  CASE WHEN ar.`id` IS NULL THEN r.`resolved_at` END,
  COALESCE(MIN(ar.`created_at`, r.`created_at`), ar.`created_at`, r.`created_at`),
  COALESCE(MAX(ar.`updated_at`, r.`updated_at`), ar.`updated_at`, r.`updated_at`)
FROM `shift_assignments` a
LEFT JOIN `attendance_records` ar ON ar.`assignment_id` = a.`id`
LEFT JOIN `assignment_reports` r ON r.`assignment_id` = a.`id` AND r.`status` <> 'withdrawn'
WHERE ar.`id` IS NOT NULL OR r.`id` IS NOT NULL;--> statement-breakpoint
INSERT INTO `assignment_attendance_events` (`id`,`assignment_id`,`actor_id`,`action`,`checked_in_at`,`created_at`)
SELECT 'checked-in-' || `id`, `assignment_id`, `member_id`, 'checked_in', `checked_in_at`, `checked_in_at` FROM `attendance_records`;--> statement-breakpoint
INSERT INTO `assignment_attendance_events` (`id`,`assignment_id`,`actor_id`,`action`,`checked_in_at`,`previous_checked_in_at`,`reason`,`created_at`)
SELECT `id`, `assignment_id`, `actor_id`, 'corrected', `after`, `before`, `reason`, `created_at` FROM `attendance_events`;--> statement-breakpoint
INSERT INTO `assignment_attendance_events` (`id`,`assignment_id`,`actor_id`,`action`,`expected_at`,`reason`,`created_at`)
SELECT e.`id`, r.`assignment_id`, e.`actor_id`,
  CASE e.`action`
    WHEN 'submitted' THEN CASE WHEN json_extract(e.`details`, '$.kind') = 'absence' THEN 'absent' ELSE 'late' END
    WHEN 'resolved' THEN 'resolved'
    ELSE 'withdrawn' END,
  CASE WHEN e.`action` = 'submitted' AND json_extract(e.`details`, '$.kind') = 'late'
    THEN CAST(strftime('%s', json_extract(e.`details`, '$.eta')) AS INTEGER) * 1000 END,
  CASE WHEN e.`action` = 'submitted' THEN COALESCE(json_extract(e.`details`, '$.message'), '') ELSE '' END,
  e.`created_at`
FROM `report_events` e JOIN `assignment_reports` r ON r.`id` = e.`report_id`;--> statement-breakpoint
DROP TABLE `assignment_reports`;--> statement-breakpoint
DROP TABLE `attendance_events`;--> statement-breakpoint
DROP TABLE `attendance_records`;--> statement-breakpoint
DROP TABLE `report_events`;