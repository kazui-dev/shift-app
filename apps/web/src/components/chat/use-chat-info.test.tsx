import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { useChatInfo } from "@/components/chat/use-chat-info"

const boundary = vi.hoisted(() => ({
  location: {
    pathname: "/chat/one",
    state: { chatOverlay: undefined as string | undefined, chatFromList: true },
  },
  back: vi.fn<() => void>(),
  navigate: vi.fn<(options: unknown) => void>(),
}))
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: { location: boundary.location, back: boundary.back },
    navigate: boundary.navigate,
  }),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: typeof boundary.location }) => boolean
  }) => select({ location: boundary.location }),
}))
function view(action?: "show" | "close", roomId: string | undefined = "one") {
  function Probe() {
    const info = useChatInfo(roomId)
    if (action) info[action]()
    return <span>{info.open ? "info" : "conversation"}</span>
  }
  return renderToStaticMarkup(<Probe />)
}
beforeEach(() => {
  vi.clearAllMocks()
  boundary.location.pathname = "/chat/one"
  boundary.location.state = { chatOverlay: undefined, chatFromList: true }
})
it("pushes information once and returns using the existing conversation history", () => {
  view("show")
  expect(boundary.navigate).toHaveBeenCalledWith({
    to: "/chat/$roomId/info",
    params: { roomId: "one" },
    state: { chatOverlay: "info", chatFromList: true },
  })
  boundary.location.pathname = "/chat/one/info"
  boundary.location.state.chatOverlay = "info"
  expect(view("show")).toContain("info")
  expect(boundary.navigate).toHaveBeenCalledTimes(1)
  view("close")
  expect(boundary.back).toHaveBeenCalledOnce()
})
it("replaces a directly opened information URL when its back arrow is pressed", () => {
  boundary.location.pathname = "/chat/one/info"
  view("close")
  expect(boundary.back).not.toHaveBeenCalled()
  expect(boundary.navigate).toHaveBeenCalledWith({
    to: "/chat/$roomId",
    params: { roomId: "one" },
    replace: true,
  })
})
it("keeps information behind its settings route", () => {
  boundary.location.pathname = "/chat/one/info/settings"
  expect(view("close")).toContain("info")
  expect(boundary.back).not.toHaveBeenCalled()
  expect(view(undefined, "two")).toContain("conversation")
})
it("does not change history when the conversation is already showing", () => {
  view("close")
  expect(boundary.back).not.toHaveBeenCalled()
  expect(boundary.navigate).not.toHaveBeenCalled()
})
