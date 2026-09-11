DROP VIEW chat_effective_permissions;
--> statement-breakpoint
CREATE VIEW chat_effective_permissions AS
WITH grants AS (
 SELECT r.id AS room_id,ym.member_id,1 AS can_read,CASE WHEN m.access_level='system_admin' THEN 1 ELSE 0 END AS can_post,CASE WHEN m.access_level='system_admin' THEN 1 ELSE 0 END AS can_manage
 FROM chat_rooms r JOIN year_memberships ym ON ym.year=r.year AND ym.status='active' JOIN app_users m ON m.id=ym.member_id WHERE r.kind='global'
 UNION ALL
 SELECT id,created_by,1,1,1 FROM chat_rooms WHERE kind='custom'
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
 CASE WHEN r.status='active' AND (r.activity_id IS NULL OR act.active=1) THEN MAX(g.can_post OR g.can_manage) ELSE 0 END AS can_post,
 MAX(g.can_manage) AS can_manage
FROM grants g JOIN chat_rooms r ON r.id=g.room_id JOIN year_memberships ym ON ym.year=r.year AND ym.member_id=g.member_id AND ym.status='active' LEFT JOIN activities act ON act.id=r.activity_id
GROUP BY g.room_id,g.member_id HAVING MAX(g.can_read OR g.can_post OR g.can_manage)=1;

--> statement-breakpoint
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
--> statement-breakpoint
CREATE TRIGGER chat_permissions_year_role_permissions_insert AFTER INSERT ON year_role_permissions BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;

--> statement-breakpoint
CREATE TRIGGER chat_permissions_year_role_permissions_update AFTER UPDATE ON year_role_permissions BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;

--> statement-breakpoint
CREATE TRIGGER chat_permissions_year_role_permissions_delete AFTER DELETE ON year_role_permissions BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;

--> statement-breakpoint
CREATE TRIGGER chat_permissions_app_users_insert AFTER INSERT ON app_users BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;

--> statement-breakpoint
CREATE TRIGGER chat_permissions_app_users_update AFTER UPDATE ON app_users BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;

--> statement-breakpoint
CREATE TRIGGER chat_permissions_app_users_delete AFTER DELETE ON app_users BEGIN
UPDATE chat_room_access SET exited_at=CAST(unixepoch('subsecond')*1000 AS INTEGER) WHERE exited_at IS NULL AND NOT EXISTS(SELECT 1 FROM chat_effective_permissions e WHERE e.room_id=chat_room_access.room_id AND e.member_id=chat_room_access.member_id);
INSERT INTO chat_room_access(room_id,member_id,exited_at) SELECT room_id,member_id,NULL FROM chat_effective_permissions WHERE 1 ON CONFLICT(room_id,member_id) DO UPDATE SET exited_at=NULL;
END;
