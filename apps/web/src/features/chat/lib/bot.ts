/**
 * The attendance bot's face, shipped with the app so it appears with the
 * message instead of loading like a member's own image.
 */
const botAvatar = "/bot-attendance.webp"

/** A sender's image: a bot always shows its own. */
export function senderImage(sender: {
  bot?: true | undefined
  memberImage?: string | null | undefined
}): string | null {
  return sender.bot ? botAvatar : (sender.memberImage ?? null)
}
