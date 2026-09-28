import { resolveDisplayYear } from "../domain/display-year"
import type { MemberContext } from "../../../lib/http"

export async function readDisplayYear(db: D1Database, member: MemberContext) {
  const [available, settings, preference] = await Promise.all([
    db
      .prepare(
        `SELECT year FROM year_memberships WHERE member_id = ? AND status = 'active' ORDER BY year DESC`
      )
      .bind(member.id)
      .all<{ year: number }>(),
    db
      .prepare("SELECT default_year AS year FROM year_settings WHERE id = 1")
      .first<{ year: number }>(),
    db
      .prepare(
        "SELECT selected_year AS year FROM user_preferences WHERE member_id = ?"
      )
      .bind(member.id)
      .first<{ year: number | null }>(),
  ])
  const years = available.results.map((item) => item.year)
  const defaultYear = settings?.year ?? null
  const selected = preference?.year ?? null
  const result = resolveDisplayYear(years, defaultYear, selected)
  if (result.unavailableSelection)
    await db
      .prepare(
        "UPDATE user_preferences SET selected_year=NULL WHERE member_id=? AND selected_year=?"
      )
      .bind(member.id, selected)
      .run()
  return result
}
