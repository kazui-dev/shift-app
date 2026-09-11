// Enrich at the HTTP boundary so old posts use the current profile image.
export async function withMemberImages<T extends { memberId: string }>(
  env: CloudflareBindings,
  messages: T[]
): Promise<Array<T & { memberImage: string | null }>> {
  const ids = [...new Set(messages.map((message) => message.memberId))]
  if (!ids.length) return []
  const profiles = await env.shift_app
    .prepare(
      `SELECT m.id,u.image FROM app_users m LEFT JOIN user u ON u.id=m.user_id WHERE m.id IN (${ids.map(() => "?").join(",")})`
    )
    .bind(...ids)
    .all<{ id: string; image: string | null }>()
  const images = new Map(
    profiles.results.map((profile) => [profile.id, profile.image])
  )
  return messages.map((message) => ({
    ...message,
    memberImage: images.get(message.memberId) ?? null,
  }))
}
