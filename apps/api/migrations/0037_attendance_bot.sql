CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bots_key_uidx` ON `bots` (`key`);--> statement-breakpoint
CREATE TABLE `chat_room_bots` (
	`room_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `bot_id`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
-- The attendance bot posts late and absence notices in shift rooms.
INSERT INTO `bots` (`id`, `key`, `display_name`, `created_at`)
VALUES ('4b8d18a0-6e42-4c6d-9f4b-7c4c58f2a901', 'attendance', '勤怠通知', unixepoch() * 1000)
ON CONFLICT(`key`) DO NOTHING;
--> statement-breakpoint
-- Shift rooms that already exist gain the bot, as newly created ones do.
INSERT INTO `chat_room_bots` (`room_id`, `bot_id`, `created_at`)
SELECT `room_id`, '4b8d18a0-6e42-4c6d-9f4b-7c4c58f2a901', unixepoch() * 1000
FROM `activity_chat_rooms` WHERE true
ON CONFLICT(`room_id`, `bot_id`) DO NOTHING;
