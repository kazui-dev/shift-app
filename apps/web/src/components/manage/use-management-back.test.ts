import { beforeEach, expect, it, vi } from "vite-plus/test"
import { useManagementBack } from "./use-management-back"

const boundary = vi.hoisted(() => ({
  state: { managementParent: undefined as string | undefined },
  back: vi.fn<() => void>(),
  navigate: vi.fn<(options: { to: string; replace: boolean }) => void>(),
}))
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: { location: { state: boundary.state }, back: boundary.back },
    navigate: boundary.navigate,
  }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  boundary.state.managementParent = undefined
})
it("unwinds the entry that opened the page instead of adding another menu entry", () => {
  boundary.state.managementParent = "/manage"
  useManagementBack("/manage")()
  expect(boundary.back).toHaveBeenCalledOnce()
  expect(boundary.navigate).not.toHaveBeenCalled()
})
it("returns to the exact shift that opened the form", () => {
  boundary.state.managementParent = "/manage/shifts/example"
  useManagementBack("/manage/shifts")()
  expect(boundary.back).toHaveBeenCalledOnce()
  expect(boundary.navigate).not.toHaveBeenCalled()
})
it("replaces a direct entry without sending the user outside the application", () => {
  useManagementBack("/manage")()
  expect(boundary.back).not.toHaveBeenCalled()
  expect(boundary.navigate).toHaveBeenCalledWith({
    to: "/manage",
    replace: true,
  })
})
