-- Resolve the two kinds of target through their keys instead of testing every
-- member of the year for every activity. UNION keeps overlapping grants unique.
DROP VIEW activity_effective_responsibles;
--> statement-breakpoint
CREATE VIEW activity_effective_responsibles AS
SELECT r.activity_id,ym.member_id FROM activity_responsibles r
JOIN activities a ON a.id=r.activity_id
JOIN year_memberships ym ON ym.year=a.year AND ym.member_id=r.target_id AND ym.status='active'
WHERE r.target_type='member'
UNION
SELECT r.activity_id,ym.member_id FROM activity_responsibles r
JOIN activities a ON a.id=r.activity_id
JOIN year_roles role ON role.id=r.target_id AND role.year=a.year
JOIN member_year_roles mr ON mr.role_id=role.id
JOIN year_memberships ym ON ym.year=a.year AND ym.member_id=mr.member_id AND ym.status='active'
WHERE r.target_type='role';
--> statement-breakpoint
DROP TRIGGER responsible_loss_activity_responsibles_delete;
DROP TRIGGER responsible_loss_activity_responsibles_update;
DROP TRIGGER responsible_loss_year_memberships_delete;
DROP TRIGGER responsible_loss_year_memberships_update;
DROP TRIGGER responsible_loss_member_year_roles_delete;
DROP TRIGGER responsible_loss_member_year_roles_update;
DROP TRIGGER responsible_loss_year_roles_delete;
DROP TRIGGER responsible_loss_year_roles_update;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_activity_responsibles_delete AFTER DELETE ON activity_responsibles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE id=OLD.activity_id AND active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_activity_responsibles_update AFTER UPDATE OF activity_id,target_type,target_id ON activity_responsibles
WHEN OLD.activity_id<>NEW.activity_id OR OLD.target_type<>NEW.target_type OR OLD.target_id<>NEW.target_id BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE id=OLD.activity_id AND active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_memberships_delete AFTER DELETE ON year_memberships WHEN OLD.status='active' BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE year=OLD.year AND active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_memberships_update AFTER UPDATE OF year,member_id,status ON year_memberships
WHEN OLD.status='active' AND (NEW.status<>'active' OR OLD.year<>NEW.year OR OLD.member_id<>NEW.member_id) BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE year=OLD.year AND active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_member_year_roles_delete AFTER DELETE ON member_year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1
 AND id IN (SELECT activity_id FROM activity_responsibles WHERE target_type='role' AND target_id=OLD.role_id)
 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_member_year_roles_update AFTER UPDATE OF member_id,role_id ON member_year_roles
WHEN OLD.member_id<>NEW.member_id OR OLD.role_id<>NEW.role_id BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1
 AND id IN (SELECT activity_id FROM activity_responsibles WHERE target_type='role' AND target_id=OLD.role_id)
 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_roles_delete AFTER DELETE ON year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE year=OLD.year AND active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_roles_update AFTER UPDATE OF year ON year_roles WHEN OLD.year<>NEW.year BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE year=OLD.year AND active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
