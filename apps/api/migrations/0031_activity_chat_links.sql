CREATE TABLE `activity_chat_rooms` (
	`activity_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_chat_rooms_room_uidx` ON `activity_chat_rooms` (`room_id`);--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`allow_exit` integer DEFAULT true NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_chat_rooms`("id", "year", "allow_exit", "last_sequence", "name", "created_by", "created_at", "updated_at") SELECT "id", "year", "allow_exit", "last_sequence", "name", "created_by", "created_at", "updated_at" FROM `chat_rooms`;--> statement-breakpoint
DROP TABLE `chat_rooms`;--> statement-breakpoint
ALTER TABLE `__new_chat_rooms` RENAME TO `chat_rooms`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE INDEX `chat_rooms_year_updatedAt_idx` ON `chat_rooms` (`year`,`updated_at`);