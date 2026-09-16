CREATE TABLE `bureaus` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`role_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `operating_years`(`year`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `year_roles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bureaus_year_name_nocase_uidx` ON `bureaus` (`year`,lower("name"));--> statement-breakpoint
CREATE TABLE `directory_duties` (
	`entry_id` text NOT NULL,
	`duty_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `duty_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `student_directory`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`duty_id`) REFERENCES `duties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `directory_duties_duty_idx` ON `directory_duties` (`duty_id`);--> statement-breakpoint
CREATE TABLE `duties` (
	`id` text PRIMARY KEY NOT NULL,
	`bureau_id` text NOT NULL,
	`name` text NOT NULL,
	`role_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bureau_id`) REFERENCES `bureaus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `year_roles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duties_bureau_name_nocase_uidx` ON `duties` (`bureau_id`,lower("name"));--> statement-breakpoint
ALTER TABLE `student_directory` ADD `bureau_id` text REFERENCES bureaus(id);--> statement-breakpoint
ALTER TABLE `student_directory` ADD `office` text;--> statement-breakpoint
CREATE INDEX `student_directory_bureau_idx` ON `student_directory` (`bureau_id`);--> statement-breakpoint
-- The bureaus and duties listings already name, keyed to the year roles that
-- carry the same name, so what a sign-in granted before is granted still.
INSERT INTO bureaus (id, year, name, role_id, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-'
    || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-'
    || lower(hex(randomblob(6))),
  listing.year, listing.bureau,
  (SELECT role.id FROM year_roles role
    WHERE role.year = listing.year AND lower(role.name) = lower(listing.bureau)),
  unixepoch() * 1000
FROM (SELECT DISTINCT year, bureau FROM student_directory WHERE bureau IS NOT NULL) listing;--> statement-breakpoint
INSERT INTO duties (id, bureau_id, name, role_id, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-'
    || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-'
    || lower(hex(randomblob(6))),
  bureau.id, listing.duty,
  (SELECT role.id FROM year_roles role
    WHERE role.year = listing.year AND lower(role.name) = lower(listing.duty)),
  unixepoch() * 1000
FROM (SELECT DISTINCT year, bureau, duty FROM student_directory
       WHERE duty IS NOT NULL AND bureau IS NOT NULL) listing
JOIN bureaus bureau ON bureau.year = listing.year AND bureau.name = listing.bureau;--> statement-breakpoint
UPDATE student_directory SET bureau_id = (
  SELECT bureau.id FROM bureaus bureau
   WHERE bureau.year = student_directory.year
     AND bureau.name = student_directory.bureau
) WHERE bureau IS NOT NULL;--> statement-breakpoint
INSERT INTO directory_duties (entry_id, duty_id)
SELECT listing.id, duty.id
FROM student_directory listing
JOIN duties duty ON duty.bureau_id = listing.bureau_id AND duty.name = listing.duty
WHERE listing.duty IS NOT NULL;
