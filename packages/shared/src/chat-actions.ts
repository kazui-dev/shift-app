export function messagePermissions(input: {
  memberId: string
  authorId: string
  canPost: boolean
  canManage: boolean
  historical: boolean
  deleted: boolean
}) {
  const active = !input.historical && !input.deleted
  const own = input.memberId === input.authorId
  return {
    reply: active && input.canPost,
    edit: active && own && input.canPost,
    delete: active && (own || input.canManage),
  }
}
