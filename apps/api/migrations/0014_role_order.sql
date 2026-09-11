ALTER TABLE `year_roles` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE year_roles SET position = (
  SELECT COUNT(*) FROM year_roles other
  WHERE other.year = year_roles.year AND (lower(other.name) > lower(year_roles.name) OR (lower(other.name) = lower(year_roles.name) AND other.id >= year_roles.id))
);
