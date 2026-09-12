ALTER TABLE push_subscriptions RENAME TO notification_devices;
--> statement-breakpoint
DROP INDEX push_subscriptions_endpoint_uidx;
--> statement-breakpoint
DROP INDEX push_subscriptions_member_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX notification_devices_endpoint_uidx ON notification_devices(endpoint);
--> statement-breakpoint
CREATE INDEX notification_devices_member_idx ON notification_devices(member_id);
