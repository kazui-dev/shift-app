/** Pure rules about a chat message: who may act on it, and where it links. */

export function messagePermissions(input: {
  memberId: string
  authorId: string
  canPost: boolean
  canManage: boolean
  deleted: boolean
}) {
  const active = !input.deleted
  const own = input.memberId === input.authorId
  return {
    reply: active && input.canPost,
    edit: active && own && input.canPost,
    delete: active && (own || input.canManage),
  }
}

export function messageLinks(content: string) {
  const parts: Array<{ text: string; href?: string; offset: number }> = []
  let end = 0
  for (const match of content.matchAll(
    /https?:\/\/[^\s<>"`「」『』（）【】]+/gi
  )) {
    let text = match[0].replace(/[.,!?;:。、]+$/u, "")
    while (
      text.endsWith(")") &&
      text.split(")").length > text.split("(").length
    )
      text = text.slice(0, -1)
    while (
      text.endsWith("]") &&
      text.split("]").length > text.split("[").length
    )
      text = text.slice(0, -1)
    let url: URL
    try {
      url = new URL(text)
    } catch {
      continue
    }
    if (url.username || url.password || text.length > 2048) continue
    if (match.index > end)
      parts.push({ text: content.slice(end, match.index), offset: end })
    parts.push({ text, href: url.href, offset: match.index })
    end = match.index + text.length
  }
  if (end < content.length)
    parts.push({ text: content.slice(end), offset: end })
  return parts
}
