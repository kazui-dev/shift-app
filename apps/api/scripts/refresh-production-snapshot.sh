#!/usr/bin/env bash
set -euo pipefail

# Only the D1 data needed by local application screens. Credentials, sessions,
# verification values, push endpoints, and chat storage are never exported.
tables=(
  user app_users
  operating_years year_settings year_roles year_role_permissions
  bureaus duties student_directory directory_duties
  year_memberships member_year_roles user_preferences
  activities activity_responsibles activity_candidate_roles
  availability_dates availability_submissions availability_windows
  availability_drafts availability_day_answers
  directory_availability_submissions directory_availability_day_answers
  directory_availability_windows
  shift_slots shift_assignments directory_shift_assignments
  assignment_attendance assignment_attendance_events
  identity_link_requests admin_audit_logs
)

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
state_root="$repo_root/.wrangler"
snapshot_dir="$state_root/production-snapshot"
mkdir -p "$state_root"
umask 077
staging_dir=$(mktemp -d "$state_root/production-snapshot-stage.XXXXXX")
sql_file=$(mktemp "$state_root/production-snapshot-data.XXXXXX.sql")
command_log=$(mktemp "$state_root/production-snapshot-command.XXXXXX.log")
chunk_dir=$(mktemp -d "$state_root/production-snapshot-chunks.XXXXXX")
backup_dir=""

cleanup() {
  rm -f "$sql_file"
  rm -f "$command_log"
  rm -rf "$chunk_dir"
  if [[ -d "$staging_dir" ]]; then rm -rf "$staging_dir"; fi
  if [[ -n "$backup_dir" && -d "$backup_dir" ]]; then
    if [[ ! -d "$snapshot_dir" ]]; then mv "$backup_dir" "$snapshot_dir"; fi
  fi
}
trap cleanup EXIT

cd "$repo_root"
table_args=()
for table in "${tables[@]}"; do table_args+=(--table "$table"); done

echo "Exporting selected production D1 tables (read only)..."
if ! vp -C apps/api exec wrangler d1 export shift-app \
  --remote --skip-confirmation --no-schema \
  "${table_args[@]}" --output "$sql_file" >"$command_log" 2>&1; then
  echo "Production D1 export failed." >&2
  exit 1
fi

# The first operating year initializes this singleton during migrations.
# Replace that initial row with the actual production default year.
if ! grep -q '^INSERT INTO "year_settings" ' "$sql_file"; then
  echo "Production default year is missing from the export." >&2
  exit 1
fi
sed -i 's/^INSERT INTO "year_settings" /INSERT OR REPLACE INTO "year_settings" /' "$sql_file"
node apps/api/scripts/chunk-snapshot-sql.mjs "$sql_file" "$chunk_dir" "${tables[@]}"

echo "Preparing an isolated local D1 database..."
if ! vp -C apps/api exec wrangler d1 migrations apply shift-app \
  --local --persist-to "$staging_dir" >"$command_log" 2>&1; then
  echo "Local snapshot migrations failed." >&2
  exit 1
fi
for chunk in "$chunk_dir"/*.sql; do
  if ! vp -C apps/api exec wrangler d1 execute shift-app \
    --local --persist-to "$staging_dir" --file "$chunk" --yes \
    >"$command_log" 2>&1; then
    cp "$command_log" "$state_root/production-snapshot-error.log"
    echo "Local snapshot import failed in batch $(basename "$chunk")." >&2
    exit 1
  fi
done
rm -f "$state_root/production-snapshot-error.log"

if [[ -d "$snapshot_dir" ]]; then
  backup_dir=$(mktemp -d "$state_root/production-snapshot-old.XXXXXX")
  rmdir "$backup_dir"
  mv "$snapshot_dir" "$backup_dir"
fi
mv "$staging_dir" "$snapshot_dir"
if [[ -n "$backup_dir" ]]; then rm -rf "$backup_dir"; fi
backup_dir=""

echo "Snapshot ready. Start the web app with SHIFT_APP_DEV_DATA=production-snapshot vp dev."
