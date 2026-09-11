CREATE TABLE `user_preferences` (
	`member_id` text PRIMARY KEY NOT NULL,
	`selected_year` integer,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TRIGGER members_join_default_year AFTER INSERT ON members
BEGIN
  INSERT INTO year_memberships (year, member_id, status, created_at, updated_at)
  SELECT default_year, NEW.id, 'active', NEW.created_at, NEW.updated_at FROM year_settings WHERE id = 1;
END;
