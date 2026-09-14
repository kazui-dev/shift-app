CREATE TABLE `chat_message_index` (
	`room_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`member_id` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`room_id`, `sequence`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
