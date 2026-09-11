CREATE TABLE `chat_room_deletions` (
	`room_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER chat_room_cleanup BEFORE DELETE ON chat_rooms BEGIN
  INSERT OR IGNORE INTO chat_room_deletions(room_id,created_at) VALUES(OLD.id,CAST(unixepoch('subsecond')*1000 AS INTEGER));
END;
