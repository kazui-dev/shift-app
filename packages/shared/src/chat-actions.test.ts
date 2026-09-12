import { expect, it } from "vite-plus/test"
import { messagePermissions } from "./chat-actions"
const base = {
  memberId: "me",
  authorId: "other",
  canPost: true,
  canManage: false,
  deleted: false,
}
it("limits editing to the author and permits room managers to delete", () => {
  expect(messagePermissions(base)).toEqual({
    reply: true,
    edit: false,
    delete: false,
  })
  expect(messagePermissions({ ...base, authorId: "me" })).toEqual({
    reply: true,
    edit: true,
    delete: true,
  })
  expect(messagePermissions({ ...base, canManage: true })).toEqual({
    reply: true,
    edit: false,
    delete: true,
  })
  expect(
    messagePermissions({ ...base, authorId: "me", canPost: false })
  ).toEqual({ reply: false, edit: false, delete: true })
  expect(
    messagePermissions({
      ...base,
      authorId: "me",
      canManage: true,
      deleted: true,
    })
  ).toEqual({ reply: false, edit: false, delete: false })
})
