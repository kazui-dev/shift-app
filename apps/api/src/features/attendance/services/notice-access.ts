/** SQL predicate shared by history, unread counts and live/push delivery.
 * Room access is checked separately; this never grants access to a chat room.
 */
export function noticeReader(member: string, room: string) {
  return `EXISTS(SELECT 1 FROM activity_chat_rooms link
    JOIN activities shift ON shift.id=link.activity_id
    JOIN year_memberships active ON active.year=shift.year AND active.member_id=${member} AND active.status='active'
    JOIN year_attendance_settings settings ON settings.year=shift.year
    WHERE link.room_id=${room} AND (
      settings.notice_audience='room_members'
      OR EXISTS(SELECT 1 FROM attendance_notice_members allowed WHERE allowed.year=shift.year AND allowed.member_id=${member})
      OR EXISTS(SELECT 1 FROM attendance_notice_roles allowed
        JOIN year_roles role ON role.id=allowed.role_id AND role.year=allowed.year
        JOIN member_year_roles held ON held.role_id=role.id AND held.member_id=${member}
        WHERE allowed.year=shift.year)))`
}
