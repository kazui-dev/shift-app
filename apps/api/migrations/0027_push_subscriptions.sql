ALTER TABLE push_devices RENAME TO push_subscriptions;
--> statement-breakpoint
DROP INDEX push_devices_endpoint_uidx;
--> statement-breakpoint
DROP INDEX push_devices_member_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX push_subscriptions_endpoint_uidx ON push_subscriptions (endpoint);
--> statement-breakpoint
CREATE INDEX push_subscriptions_member_idx ON push_subscriptions (member_id);
