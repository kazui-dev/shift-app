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
