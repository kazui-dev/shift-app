/** Keep each source paired with its own windows; joining two UNIONs repeats
 * both submission scans and probes the unrelated source's window index. */
export const planningAvailability = `
 SELECT s.member_id AS memberId,w.starts_at AS startsAt,w.ends_at AS endsAt
 FROM availability_submissions s
 LEFT JOIN availability_windows w ON w.submission_id=s.id
 WHERE s.year=?1 AND s.status='submitted'
 UNION ALL
 SELECT s.id,w.starts_at,w.ends_at
 FROM student_directory d JOIN directory_availability_submissions s ON s.entry_id=d.id
 LEFT JOIN directory_availability_windows w ON w.submission_id=s.id
 WHERE d.year=?1 AND d.status='active' AND s.submitted_at IS NOT NULL`

/** Filter the year before deduplicating bureau, duty and explicitly held roles. */
export const planningMemberRoles = `
 SELECT mr.member_id AS memberId,r.id,r.name,r.color
 FROM year_roles r JOIN member_year_roles mr ON mr.role_id=r.id WHERE r.year=?1
 UNION
 SELECT s.id,r.id,r.name,r.color
 FROM student_directory d JOIN directory_availability_submissions s ON s.entry_id=d.id
 JOIN bureaus b ON b.id=d.bureau_id JOIN year_roles r ON r.id=b.role_id
 WHERE d.year=?1 AND d.status='active' AND r.year=?1
 UNION
 SELECT s.id,r.id,r.name,r.color
 FROM student_directory d JOIN directory_availability_submissions s ON s.entry_id=d.id
 JOIN directory_duties dd ON dd.entry_id=d.id JOIN duties duty ON duty.id=dd.duty_id
 JOIN year_roles r ON r.id=duty.role_id
 WHERE d.year=?1 AND d.status='active' AND r.year=?1`

/** Current submitted day answers, keeping each identity source paired. */
export const planningAvailabilityAnswers = `
 SELECT s.member_id AS memberId,d.date,a.choice
 FROM availability_submissions s
 JOIN availability_day_answers a ON a.submission_id=s.id
 JOIN availability_dates d ON d.id=a.date_id AND d.version=a.date_version AND d.deleted=0 AND d.year=s.year
 WHERE s.year=?1 AND s.status='submitted'
 UNION ALL
 SELECT s.id,d.date,a.choice
 FROM student_directory m JOIN directory_availability_submissions s ON s.entry_id=m.id
 JOIN directory_availability_day_answers a ON a.submission_id=s.id
 JOIN availability_dates d ON d.id=a.date_id AND d.version=a.date_version AND d.deleted=0 AND d.year=m.year
 WHERE m.year=?1 AND m.status='active' AND s.submitted_at IS NOT NULL`
