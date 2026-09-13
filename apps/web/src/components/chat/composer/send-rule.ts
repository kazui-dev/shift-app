import type { ChatDraft } from "@/lib/chat/store"

/**
 * Whether the composer can submit. An edit saves text only, so images waiting
 * in the draft neither enable nor block it; the edited message's own images do.
 */
export function canSubmit(
  draft: Pick<ChatDraft, "content" | "files">,
  editing: { hasImages: boolean } | undefined
) {
  const text = draft.content.trim().length > 0
  return editing ? text || editing.hasImages : text || draft.files.length > 0
}
