DROP TRIGGER `activities_rename_room`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_year_memberships_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_year_memberships_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_year_memberships_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_year_memberships_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_year_memberships_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_year_memberships_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_member_year_roles_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_member_year_roles_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_member_year_roles_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_member_year_roles_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_member_year_roles_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_member_year_roles_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_shift_assignments_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_shift_assignments_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_shift_assignments_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_shift_assignments_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_shift_assignments_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_shift_assignments_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_activity_responsibles_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_activity_responsibles_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_activity_responsibles_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_activity_responsibles_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_activity_responsibles_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_activity_responsibles_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_chat_room_targets_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_chat_room_targets_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_chat_room_targets_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_chat_room_targets_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_chat_room_targets_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_chat_room_targets_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_chat_rooms_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_chat_rooms_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_chat_rooms_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_chat_rooms_update`;
--> statement-breakpoint
DROP TRIGGER `chat_access_before_chat_rooms_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_access_after_chat_rooms_delete`;
--> statement-breakpoint
DROP TRIGGER `activities_delete_room`;
--> statement-breakpoint
DROP TRIGGER `chat_permissions_year_role_permissions_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_permissions_year_role_permissions_update`;
--> statement-breakpoint
DROP TRIGGER `chat_permissions_year_role_permissions_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_permissions_app_users_insert`;
--> statement-breakpoint
DROP TRIGGER `chat_permissions_app_users_update`;
--> statement-breakpoint
DROP TRIGGER `chat_permissions_app_users_delete`;
--> statement-breakpoint
DROP TRIGGER `chat_room_cleanup`;
--> statement-breakpoint
DROP TRIGGER `chat_exit_access`;
--> statement-breakpoint
DROP TRIGGER `chat_reinvite`;
--> statement-breakpoint
DROP TRIGGER `chat_rejoin_access`;
--> statement-breakpoint
DROP TRIGGER `activities_create_room`;
--> statement-breakpoint
DROP TRIGGER `operating_years_create_global_room`;
--> statement-breakpoint
DROP TRIGGER `members_create_global_room`;
--> statement-breakpoint
DROP TRIGGER `chat_exit_last_manager`;
--> statement-breakpoint
DROP VIEW chat_effective_permissions;
--> statement-breakpoint
INSERT OR IGNORE INTO chat_room_deletions(room_id,created_at) SELECT id,CAST(unixepoch('subsecond')*1000 AS INTEGER) FROM chat_rooms;
--> statement-breakpoint
DELETE FROM chat_rooms;
--> statement-breakpoint
DROP TABLE `chat_room_access`;--> statement-breakpoint
DROP INDEX `chat_rooms_global_year_uidx`;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `allow_exit` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_rooms` DROP COLUMN `kind`;
