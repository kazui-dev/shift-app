ALTER TABLE `shift_slots` ADD `deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TRIGGER shift_slot_overlap_update BEFORE UPDATE OF starts_at, ends_at ON shift_slots
BEGIN
  SELECT RAISE(ABORT, 'SHIFT_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM shift_assignments own JOIN shift_assignments other ON other.member_id=own.member_id AND other.id<>own.id AND other.status='active'
    JOIN shift_slots s ON s.id=other.slot_id
    WHERE own.slot_id=NEW.id AND own.status='active' AND s.starts_at<NEW.ends_at AND s.ends_at>NEW.starts_at
  );
END;
