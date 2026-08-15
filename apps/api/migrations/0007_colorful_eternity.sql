CREATE TABLE `notification_deliveries` (
	`assignment_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'claimed' NOT NULL,
	`claimed_at` integer NOT NULL,
	`sent_at` integer,
	PRIMARY KEY(`assignment_id`, `subscription_id`, `kind`),
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_claimedAt_idx` ON `notification_deliveries` (`status`,`claimed_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`expiration_time` integer,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_uidx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_member_idx` ON `push_subscriptions` (`member_id`);