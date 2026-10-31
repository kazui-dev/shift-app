ALTER TABLE `year_tags` ADD `position` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY year ORDER BY name, id) - 1 AS position
  FROM year_tags
)
UPDATE year_tags SET position = (SELECT position FROM ordered WHERE ordered.id = year_tags.id);
