CREATE TABLE `shift_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`required_count` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shift_requirements_time_check" CHECK("shift_requirements"."starts_at" < "shift_requirements"."ends_at"),
	CONSTRAINT "shift_requirements_count_check" CHECK("shift_requirements"."required_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `shift_requirements_activity_idx` ON `shift_requirements` (`activity_id`,`starts_at`);
--> statement-breakpoint
CREATE TRIGGER `shift_requirements_no_overlap` BEFORE INSERT ON `shift_requirements`
WHEN EXISTS (SELECT 1 FROM `shift_requirements` AS existing
  WHERE existing.`activity_id` = NEW.`activity_id`
    AND existing.`starts_at` < NEW.`ends_at` AND existing.`ends_at` > NEW.`starts_at`)
BEGIN SELECT RAISE(ABORT, 'INVALID_REQUIREMENTS'); END;
--> statement-breakpoint
INSERT INTO `shift_requirements` (`id`,`activity_id`,`starts_at`,`ends_at`,`required_count`)
SELECT `id`,`activity_id`,`starts_at`,`ends_at`,`capacity`
FROM `shift_slots` AS slot
WHERE slot.`deleted` = 0 AND slot.`capacity` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `shift_assignments` AS assignment WHERE assignment.`slot_id` = slot.`id` AND assignment.`status` = 'active')
  AND NOT EXISTS (SELECT 1 FROM `directory_shift_assignments` AS assignment WHERE assignment.`slot_id` = slot.`id`);
