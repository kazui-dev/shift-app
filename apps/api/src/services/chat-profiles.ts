// Enrich at the HTTP boundary so old posts use the current profile image.
export async function withMemberImages<
  T extends { memberId: string; reply?: { memberId: string } },
>(env: CloudflareBindings, messages: T[]) {
  const ids = [
    ...new Set(
      messages.flatMap((message) =>
        message.reply
          ? [message.memberId, message.reply.memberId]
          : [message.memberId]
      )
    ),
  ]
  if (!ids.length) return []
  const profiles = await env.shift_app
    .prepare(
      "SELECT m.id,u.image FROM app_users m LEFT JOIN user u ON u.id=m.user_id WHERE m.id IN (SELECT value FROM json_each(?))"
    )
    .bind(JSON.stringify(ids))
    .all<{ id: string; image: string | null }>()
  const images = new Map(
    profiles.results.map((profile) => [profile.id, profile.image])
  )
  return messages.map((message) => ({
    ...message,
    memberImage: images.get(message.memberId) ?? null,
    ...(message.reply
      ? {
          reply: {
            ...message.reply,
            memberImage: images.get(message.reply.memberId) ?? null,
          },
        }
      : {}),
  }))
}
