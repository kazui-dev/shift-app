CREATE TABLE `chat_room_access` (
	`room_id` text NOT NULL,
	`member_id` text NOT NULL,
	`exited_at` integer,
	PRIMARY KEY(`room_id`, `member_id`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_room_preferences` (
	`room_id` text NOT NULL,
	`member_id` text NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`last_read` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`room_id`, `member_id`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `chat_room_targets` ADD `can_read` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_room_targets` ADD `can_post` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_room_targets` ADD `can_manage` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `kind` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `activity_id` text REFERENCES activities(id);--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `last_sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `chat_rooms_activity_uidx` ON `chat_rooms` (`activity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_rooms_global_year_uidx` ON `chat_rooms` (`year`) WHERE "chat_rooms"."kind" = 'global';--> statement-breakpoint
CREATE VIEW chat_effective_permissions AS
WITH grants AS (
 SELECT r.id AS room_id,ym.member_id,1 AS can_read,CASE WHEN m.access_level='system_admin' THEN 1 ELSE 0 END AS can_post,CASE WHEN m.access_level='system_admin' THEN 1 ELSE 0 END AS can_manage
 FROM chat_rooms r JOIN year_memberships ym ON ym.year=r.year AND ym.status='active' JOIN members m ON m.id=ym.member_id WHERE r.kind='global'
 UNION ALL
 SELECT id,created_by,1,1,1 FROM chat_rooms WHERE kind='custom'
 UNION ALL
 SELECT r.id,a.member_id,1,1,0 FROM chat_rooms r JOIN shift_slots s ON s.activity_id=r.activity_id JOIN shift_assignments a ON a.slot_id=s.id AND a.status='active' WHERE r.kind='shift'
 UNION ALL
 SELECT r.id,ym.member_id,1,1,1 FROM chat_rooms r JOIN activity_responsibles ar ON ar.activity_id=r.activity_id JOIN year_memberships ym ON ym.year=r.year AND ym.status='active'
 WHERE (ar.target_type='member' AND ar.target_id=ym.member_id) OR (ar.target_type='role' AND EXISTS (SELECT 1 FROM member_year_roles mr WHERE mr.role_id=ar.target_id AND mr.member_id=ym.member_id))
 UNION ALL
 SELECT t.room_id,ym.member_id,t.can_read,t.can_post,t.can_manage FROM chat_room_targets t JOIN chat_rooms r ON r.id=t.room_id JOIN year_memberships ym ON ym.year=r.year AND ym.status='active'
 WHERE (t.target_type='member' AND t.target_id=ym.member_id)
 OR (t.target_type='role' AND EXISTS (SELECT 1 FROM member_year_roles mr WHERE mr.member_id=ym.member_id AND mr.role_id=t.target_id))
 OR (t.target_type='activity' AND EXISTS (SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id WHERE s.activity_id=t.target_id AND a.member_id=ym.member_id AND a.status='active'))
)
SELECT g.room_id,g.member_id,MAX(g.can_read OR g.can_post OR g.can_manage) AS can_read,
 CASE WHEN r.status='active' AND (r.activity_id IS NULL OR act.active=1) THEN MAX(g.can_post OR g.can_manage) ELSE 0 END AS can_post,
 MAX(g.can_manage) AS can_manage
FROM grants g JOIN chat_rooms r ON r.id=g.room_id JOIN year_memberships ym ON ym.year=r.year AND ym.member_id=g.member_id AND ym.status='active' LEFT JOIN activities act ON act.id=r.activity_id
GROUP BY g.room_id,g.member_id HAVING MAX(g.can_read OR g.can_post OR g.can_manage)=1;
--> statement-breakpoint
INSERT INTO chat_rooms (id,year,name,status,created_by,created_at,updated_at,kind,activity_id)
SELECT a.id,a.year,a.name,'active',a.created_by,a.created_at,a.updated_at,'shift',a.id FROM activities a;
--> statement-breakpoint
CREATE TRIGGER activities_create_room AFTER INSERT ON activities BEGIN
 INSERT INTO chat_rooms (id,year,name,status,created_by,created_at,updated_at,kind,activity_id)
 VALUES (NEW.id,NEW.year,NEW.name,'active',NEW.created_by,NEW.created_at,NEW.updated_at,'shift',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER activities_rename_room AFTER UPDATE OF name ON activities BEGIN
 UPDATE chat_rooms SET name=NEW.name WHERE activity_id=NEW.id;
END;

--> statement-breakpoint
INSERT OR IGNORE INTO chat_rooms (id,year,name,status,created_by,created_at,updated_at,kind)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),y.year,'全体連絡','active',(SELECT id FROM members ORDER BY created_at LIMIT 1),y.created_at,y.updated_at,'global' FROM operating_years y WHERE EXISTS (SELECT 1 FROM members) AND NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.year=y.year AND r.kind='global');
--> statement-breakpoint
CREATE TRIGGER operating_years_create_global_room AFTER INSERT ON operating_years BEGIN
INSERT OR IGNORE INTO chat_rooms (id,year,name,status,created_by,created_at,updated_at,kind)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),y.year,'全体連絡','active',(SELECT id FROM members ORDER BY created_at LIMIT 1),y.created_at,y.updated_at,'global' FROM operating_years y WHERE EXISTS (SELECT 1 FROM members) AND NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.year=y.year AND r.kind='global');
END;
--> statement-breakpoint
CREATE TRIGGER members_create_global_room AFTER INSERT ON members BEGIN
INSERT OR IGNORE INTO chat_rooms (id,year,name,status,created_by,created_at,updated_at,kind)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),y.year,'全体連絡','active',(SELECT id FROM members ORDER BY created_at LIMIT 1),y.created_at,y.updated_at,'global' FROM operating_years y WHERE EXISTS (SELECT 1 FROM members) AND NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.year=y.year AND r.kind='global');
END;
--> statement-breakpoint
INSERT INTO chat_room_access (room_id,member_id) SELECT room_id,member_id FROM chat_effective_permissions;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_year_memberships_insert BEFORE INSERT ON year_memberships BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_year_memberships_insert AFTER INSERT ON year_memberships BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_year_memberships_update BEFORE UPDATE ON year_memberships BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_year_memberships_update AFTER UPDATE ON year_memberships BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_year_memberships_delete BEFORE DELETE ON year_memberships BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_year_memberships_delete AFTER DELETE ON year_memberships BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_member_year_roles_insert BEFORE INSERT ON member_year_roles BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_member_year_roles_insert AFTER INSERT ON member_year_roles BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_member_year_roles_update BEFORE UPDATE ON member_year_roles BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_member_year_roles_update AFTER UPDATE ON member_year_roles BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_member_year_roles_delete BEFORE DELETE ON member_year_roles BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_member_year_roles_delete AFTER DELETE ON member_year_roles BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_shift_assignments_insert BEFORE INSERT ON shift_assignments BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_shift_assignments_insert AFTER INSERT ON shift_assignments BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_shift_assignments_update BEFORE UPDATE ON shift_assignments BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_shift_assignments_update AFTER UPDATE ON shift_assignments BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_shift_assignments_delete BEFORE DELETE ON shift_assignments BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_shift_assignments_delete AFTER DELETE ON shift_assignments BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_activity_responsibles_insert BEFORE INSERT ON activity_responsibles BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_activity_responsibles_insert AFTER INSERT ON activity_responsibles BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_activity_responsibles_update BEFORE UPDATE ON activity_responsibles BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_activity_responsibles_update AFTER UPDATE ON activity_responsibles BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_activity_responsibles_delete BEFORE DELETE ON activity_responsibles BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_activity_responsibles_delete AFTER DELETE ON activity_responsibles BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_chat_room_targets_insert BEFORE INSERT ON chat_room_targets BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_chat_room_targets_insert AFTER INSERT ON chat_room_targets BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_chat_room_targets_update BEFORE UPDATE ON chat_room_targets BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_chat_room_targets_update AFTER UPDATE ON chat_room_targets BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_chat_room_targets_delete BEFORE DELETE ON chat_room_targets BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_chat_room_targets_delete AFTER DELETE ON chat_room_targets BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_chat_rooms_insert BEFORE INSERT ON chat_rooms BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_chat_rooms_insert AFTER INSERT ON chat_rooms BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_chat_rooms_update BEFORE UPDATE ON chat_rooms BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_chat_rooms_update AFTER UPDATE ON chat_rooms BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_before_chat_rooms_delete BEFORE DELETE ON chat_rooms BEGIN
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
--> statement-breakpoint
CREATE TRIGGER chat_access_after_chat_rooms_delete AFTER DELETE ON chat_rooms BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access (room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
