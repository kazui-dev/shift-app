CREATE TABLE `activity_candidate_roles` (
	`activity_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`activity_id`, `role_id`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `year_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE VIEW activity_effective_responsibles AS
SELECT DISTINCT r.activity_id, ym.member_id FROM activity_responsibles r
JOIN activities a ON a.id=r.activity_id
JOIN year_memberships ym ON ym.year=a.year AND ym.status='active'
WHERE (r.target_type='member' AND r.target_id=ym.member_id)
OR (r.target_type='role' AND EXISTS (SELECT 1 FROM member_year_roles mr JOIN year_roles role ON role.id=mr.role_id WHERE mr.member_id=ym.member_id AND mr.role_id=r.target_id AND role.year=a.year));
--> statement-breakpoint
UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
--> statement-breakpoint
CREATE TRIGGER activities_require_responsible BEFORE UPDATE OF active ON activities
WHEN NEW.active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'RESPONSIBLE_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER activities_create_inactive BEFORE INSERT ON activities WHEN NEW.active=1
BEGIN SELECT RAISE(ABORT,'RESPONSIBLE_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER slots_require_owner BEFORE UPDATE OF activity_id ON shift_slots WHEN NEW.activity_id<>OLD.activity_id
BEGIN SELECT RAISE(ABORT,'INVALID_SLOT'); END;
--> statement-breakpoint
CREATE TRIGGER assignments_require_membership BEFORE INSERT ON shift_assignments WHEN NEW.status='active' AND NOT EXISTS (
 SELECT 1 FROM shift_slots s JOIN activities a ON a.id=s.activity_id JOIN year_memberships ym ON ym.year=a.year AND ym.member_id=NEW.member_id AND ym.status='active' WHERE s.id=NEW.slot_id AND s.deleted=0)
BEGIN SELECT RAISE(ABORT,'YEAR_MEMBERSHIP_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER assignments_update_require_membership BEFORE UPDATE ON shift_assignments WHEN NEW.status='active' AND NOT EXISTS (
 SELECT 1 FROM shift_slots s JOIN activities a ON a.id=s.activity_id JOIN year_memberships ym ON ym.year=a.year AND ym.member_id=NEW.member_id AND ym.status='active' WHERE s.id=NEW.slot_id AND s.deleted=0)
BEGIN SELECT RAISE(ABORT,'YEAR_MEMBERSHIP_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER activities_delete_room BEFORE DELETE ON activities BEGIN DELETE FROM chat_rooms WHERE activity_id=OLD.id; END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_activity_responsibles_delete AFTER DELETE ON activity_responsibles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_activity_responsibles_update AFTER UPDATE ON activity_responsibles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_memberships_delete AFTER DELETE ON year_memberships BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_memberships_update AFTER UPDATE ON year_memberships BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_member_year_roles_delete AFTER DELETE ON member_year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_member_year_roles_update AFTER UPDATE ON member_year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_roles_delete AFTER DELETE ON year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;

--> statement-breakpoint
CREATE TRIGGER responsible_loss_year_roles_update AFTER UPDATE ON year_roles BEGIN
 UPDATE activities SET active=0,version=version+1 WHERE active=1 AND NOT EXISTS (SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activities.id);
END;
