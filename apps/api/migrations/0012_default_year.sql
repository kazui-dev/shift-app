CREATE TABLE `year_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_year` integer NOT NULL,
	FOREIGN KEY (`default_year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "year_settings_singleton_check" CHECK("year_settings"."id" = 1)
);
--> statement-breakpoint
-- Preserve the newest active year, falling back to the newest existing year.
INSERT INTO year_settings (id, default_year)
SELECT 1, year FROM operating_years
ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, year DESC
LIMIT 1;
--> statement-breakpoint
ALTER TABLE `operating_years` DROP COLUMN `status`;
--> statement-breakpoint
-- The first year initializes the singleton, including on a fresh database.
CREATE TRIGGER operating_years_initialize_default
AFTER INSERT ON operating_years
WHEN NOT EXISTS (SELECT 1 FROM year_settings)
BEGIN
  INSERT INTO year_settings (id, default_year) VALUES (1, NEW.year);
END;
--> statement-breakpoint
-- The check, foreign key, and trigger enforce exactly one valid default.
CREATE TRIGGER year_settings_prevent_delete
BEFORE DELETE ON year_settings
BEGIN
  SELECT RAISE(ABORT, 'A default year is required');
END;
