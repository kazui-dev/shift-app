CREATE TABLE `activity_history` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`before` text NOT NULL,
	`after` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `activity_responsibles` (
	`activity_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	PRIMARY KEY(`activity_id`, `target_type`, `target_id`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shift_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`capacity` integer,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shift_slots_time_check" CHECK("shift_slots"."starts_at" < "shift_slots"."ends_at")
);
--> statement-breakpoint
-- Preserve dependent records while rebuilding their referenced table.
CREATE TABLE _slots_attendance_backup AS SELECT * FROM attendance_records;
--> statement-breakpoint
CREATE TABLE _slots_reports_backup AS SELECT * FROM assignment_reports;
--> statement-breakpoint
CREATE TABLE _slots_deliveries_backup AS SELECT * FROM notification_deliveries;
--> statement-breakpoint
INSERT INTO shift_slots (id, activity_id, starts_at, ends_at)
SELECT MIN(id), activity_id, starts_at, ends_at FROM shift_assignments GROUP BY activity_id, starts_at, ends_at;--> statement-breakpoint
CREATE TABLE `__new_shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`member_id` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`cancelled_by` text,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `shift_slots`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cancelled_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_shift_assignments`("id", "slot_id", "member_id", "notes", "status", "created_by", "cancelled_by", "cancelled_at", "created_at", "updated_at") SELECT a.id, s.id, a.member_id, a.notes, a.status, a.created_by, a.cancelled_by, a.cancelled_at, a.created_at, a.updated_at FROM shift_assignments a JOIN shift_slots s ON s.activity_id = a.activity_id AND s.starts_at = a.starts_at AND s.ends_at = a.ends_at;--> statement-breakpoint
DROP TABLE `shift_assignments`;--> statement-breakpoint
ALTER TABLE `__new_shift_assignments` RENAME TO `shift_assignments`;--> statement-breakpoint
INSERT OR IGNORE INTO attendance_records SELECT * FROM _slots_attendance_backup;
--> statement-breakpoint
INSERT OR IGNORE INTO assignment_reports SELECT * FROM _slots_reports_backup;
--> statement-breakpoint
INSERT OR IGNORE INTO notification_deliveries SELECT * FROM _slots_deliveries_backup;
--> statement-breakpoint
DROP TABLE _slots_attendance_backup;
--> statement-breakpoint
DROP TABLE _slots_reports_backup;
--> statement-breakpoint
DROP TABLE _slots_deliveries_backup;--> statement-breakpoint
CREATE UNIQUE INDEX `shift_assignments_slot_member_uidx` ON `shift_assignments` (`slot_id`,`member_id`) WHERE "shift_assignments"."status" = 'active';--> statement-breakpoint
CREATE INDEX `shift_assignments_member_idx` ON `shift_assignments` (`member_id`);--> statement-breakpoint
ALTER TABLE `activities` ADD `active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
INSERT INTO activity_responsibles (activity_id, target_type, target_id) SELECT id, 'member', created_by FROM activities;
--> statement-breakpoint
UPDATE activities SET active = 1 WHERE EXISTS (SELECT 1 FROM year_memberships ym WHERE ym.year = activities.year AND ym.member_id = activities.created_by AND ym.status = 'active');
--> statement-breakpoint
CREATE TRIGGER shift_assignment_overlap_insert BEFORE INSERT ON shift_assignments WHEN NEW.status = 'active'
BEGIN
 SELECT RAISE(ABORT, 'SHIFT_OVERLAP') WHERE EXISTS (
   SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN shift_slots n ON n.id = NEW.slot_id
   WHERE a.member_id = NEW.member_id AND a.status = 'active' AND s.starts_at < n.ends_at AND s.ends_at > n.starts_at
 );
END;
--> statement-breakpoint
CREATE TRIGGER shift_assignment_overlap_update BEFORE UPDATE OF slot_id, member_id, status ON shift_assignments WHEN NEW.status = 'active'
BEGIN
 SELECT RAISE(ABORT, 'SHIFT_OVERLAP') WHERE EXISTS (
   SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN shift_slots n ON n.id = NEW.slot_id
   WHERE a.id <> NEW.id AND a.member_id = NEW.member_id AND a.status = 'active' AND s.starts_at < n.ends_at AND s.ends_at > n.starts_at
 );
END;
