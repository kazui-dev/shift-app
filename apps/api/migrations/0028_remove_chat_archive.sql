DROP VIEW chat_effective_permissions;
--> statement-breakpoint
CREATE VIEW chat_effective_permissions AS
WITH grants AS (
 SELECT r.id AS room_id,ym.member_id,1 AS can_read,CASE WHEN m.access_level='system_admin' OR r.kind='custom' THEN 1 ELSE 0 END AS can_post,CASE WHEN m.access_level='system_admin' OR r.kind='custom' THEN 1 ELSE 0 END AS can_manage
 FROM chat_rooms r JOIN year_memberships ym ON ym.year=r.year AND ym.status='active' JOIN app_users m ON m.id=ym.member_id WHERE r.kind='global' OR (r.kind='custom' AND r.created_by=ym.member_id)
 UNION ALL
 SELECT r.id,ym.member_id,1,1,1 FROM chat_rooms r JOIN year_memberships ym ON ym.year=r.year AND ym.status='active' JOIN app_users m ON m.id=ym.member_id
 WHERE r.kind='shift' AND (m.access_level='system_admin' OR EXISTS(SELECT 1 FROM member_year_roles mr JOIN year_roles role ON role.id=mr.role_id JOIN year_role_permissions p ON p.role_id=role.id WHERE mr.member_id=ym.member_id AND role.year=r.year AND p.permission='shift.manage'))
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
 CASE WHEN (r.activity_id IS NULL OR act.active=1) THEN MAX(g.can_post OR g.can_manage) ELSE 0 END AS can_post,
 MAX(g.can_manage) AS can_manage
FROM grants g JOIN chat_rooms r ON r.id=g.room_id JOIN year_memberships ym ON ym.year=r.year AND ym.member_id=g.member_id AND ym.status='active' LEFT JOIN activities act ON act.id=r.activity_id
WHERE NOT EXISTS(SELECT 1 FROM chat_room_exits x WHERE x.room_id=g.room_id AND x.member_id=g.member_id)
GROUP BY g.room_id,g.member_id HAVING MAX(g.can_read OR g.can_post OR g.can_manage)=1;
--> statement-breakpoint
DROP TRIGGER activities_create_room;
--> statement-breakpoint
CREATE TRIGGER activities_create_room AFTER INSERT ON activities BEGIN
 INSERT INTO chat_rooms (id,year,name,created_by,created_at,updated_at,kind,activity_id)
 VALUES (NEW.id,NEW.year,NEW.name,NEW.created_by,NEW.created_at,NEW.updated_at,'shift',NEW.id);
END;
--> statement-breakpoint
DROP TRIGGER operating_years_create_global_room;
--> statement-breakpoint
CREATE TRIGGER operating_years_create_global_room AFTER INSERT ON operating_years BEGIN
INSERT OR IGNORE INTO chat_rooms (id,year,name,created_by,created_at,updated_at,kind)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),y.year,'全体連絡',(SELECT id FROM "app_users" ORDER BY created_at LIMIT 1),y.created_at,y.updated_at,'global' FROM operating_years y WHERE EXISTS (SELECT 1 FROM "app_users") AND NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.year=y.year AND r.kind='global');
END;
--> statement-breakpoint
DROP TRIGGER members_create_global_room;
--> statement-breakpoint
CREATE TRIGGER members_create_global_room AFTER INSERT ON "app_users" BEGIN
INSERT OR IGNORE INTO chat_rooms (id,year,name,created_by,created_at,updated_at,kind)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),y.year,'全体連絡',(SELECT id FROM "app_users" ORDER BY created_at LIMIT 1),y.created_at,y.updated_at,'global' FROM operating_years y WHERE EXISTS (SELECT 1 FROM "app_users") AND NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.year=y.year AND r.kind='global');
END;
--> statement-breakpoint
DROP TRIGGER chat_exit_last_manager;
--> statement-breakpoint
CREATE TRIGGER chat_exit_last_manager BEFORE INSERT ON chat_room_exits
WHEN EXISTS(SELECT 1 FROM chat_rooms WHERE id=NEW.room_id AND kind='custom')
AND EXISTS(SELECT 1 FROM chat_effective_permissions WHERE room_id=NEW.room_id AND member_id=NEW.member_id AND can_manage=1)
AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions WHERE room_id=NEW.room_id AND member_id<>NEW.member_id AND can_manage=1)
BEGIN SELECT RAISE(ABORT,'LAST_CHAT_MANAGER'); END;
--> statement-breakpoint
DROP INDEX `chat_rooms_year_status_updatedAt_idx`;--> statement-breakpoint
CREATE INDEX `chat_rooms_year_updatedAt_idx` ON `chat_rooms` (`year`,`updated_at`);--> statement-breakpoint
ALTER TABLE `chat_rooms` DROP COLUMN `status`;
