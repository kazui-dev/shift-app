CREATE TABLE `chat_room_targets` (
	`room_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `target_type`, `target_id`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_room_targets_lookup_idx` ON `chat_room_targets` (`target_type`,`target_id`,`room_id`);--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `chat_rooms_year_status_updatedAt_idx` ON `chat_rooms` (`year`,`status`,`updated_at`);