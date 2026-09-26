import { expect, it } from "vite-plus/test"
import { canOpenManagement } from "./management"

it("opens management for administrators and for members who manage a year", () => {
  expect(canOpenManagement("system_admin", [])).toBe(true)
  expect(
    canOpenManagement("member", [{ canManage: false }, { canManage: true }])
  ).toBe(true)
})

it("keeps management closed for members without a manageable year", () => {
  expect(canOpenManagement("member", [])).toBe(false)
  expect(canOpenManagement("leader", [{ canManage: false }])).toBe(false)
})
