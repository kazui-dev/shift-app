-- The deployed roster sign-in code predating directory status still matches
-- inactive listings. Refuse member creation while their year is the default.
CREATE TRIGGER directory_inactive_member_guard BEFORE INSERT ON app_users
WHEN EXISTS (
  SELECT 1 FROM student_directory d JOIN year_settings ys ON ys.default_year=d.year
  WHERE d.status='inactive' AND upper(d.student_id)=upper(NEW.student_id)
)
BEGIN SELECT RAISE(ABORT,'DIRECTORY_INACTIVE'); END;
