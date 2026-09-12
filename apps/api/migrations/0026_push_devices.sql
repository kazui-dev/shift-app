PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE `__new_push_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`endpoint` text,
	`expiration_time` integer,
	`p256dh` text,
	`auth` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
INSERT INTO __new_push_devices (id, member_id, enabled, endpoint, expiration_time, p256dh, auth, created_at, updated_at)
 SELECT id, member_id, 1, endpoint, expiration_time, p256dh, auth, created_at, updated_at FROM push_subscriptions;
--> statement-breakpoint
CREATE TABLE `__new_notification_deliveries` (
	`assignment_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'claimed' NOT NULL,
	`claimed_at` integer NOT NULL,
	`sent_at` integer,
	PRIMARY KEY(`assignment_id`, `subscription_id`, `kind`),
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `__new_push_devices`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
INSERT INTO __new_notification_deliveries SELECT * FROM notification_deliveries;
--> statement-breakpoint
DROP TABLE notification_deliveries;
--> statement-breakpoint
DROP TABLE push_subscriptions;
--> statement-breakpoint
ALTER TABLE __new_push_devices RENAME TO push_devices;
--> statement-breakpoint
ALTER TABLE __new_notification_deliveries RENAME TO notification_deliveries;
--> statement-breakpoint
CREATE UNIQUE INDEX push_devices_endpoint_uidx ON push_devices (endpoint);
--> statement-breakpoint
CREATE INDEX push_devices_member_idx ON push_devices (member_id);
--> statement-breakpoint
CREATE INDEX notification_deliveries_status_claimedAt_idx ON notification_deliveries (status, claimed_at);
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
