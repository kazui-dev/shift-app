import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { keys } from "@/data/keys"
import { toast } from "@workspace/ui/lib/toast"
import { ApiError } from "@/api/client"
import { queryClient } from "./query-client"

vi.mock("@workspace/ui/lib/toast", () => ({
  toast: {
    error: vi.fn<typeof toast.error>(),
    dismiss: vi.fn<typeof toast.dismiss>(),
  },
}))

beforeEach(() => {
  vi.stubGlobal("navigator", { onLine: true })
  vi.clearAllMocks()
})
afterEach(() => {
  queryClient.clear()
  vi.unstubAllGlobals()
})

const failure = new ApiError("読み込めませんでした。", 500, "REQUEST_FAILED")
function request(key: string) {
  return queryClient.fetchQuery({
    queryKey: [key],
    queryFn: () => Promise.reject(failure),
    retry: false,
  })
}

it("reports a shared failed request once and dismisses its toast on recovery", async () => {
  await Promise.allSettled([request("chat-rooms"), request("chat-rooms")])
  expect(toast.error).toHaveBeenCalledTimes(1)
  expect(toast.error).toHaveBeenCalledWith(failure.message, {
    id: 'query:["chat-rooms"]',
  })
  await queryClient.fetchQuery({
    queryKey: keys.chatRooms(),
    queryFn: () => Promise.resolve([]),
  })
  expect(toast.dismiss).toHaveBeenCalledWith('query:["chat-rooms"]')
})

it("leaves authentication failures to the account boundary", async () => {
  await expect(request("account")).rejects.toBe(failure)
  expect(toast.error).not.toHaveBeenCalled()
})

it("does not add connection error toasts while offline", async () => {
  vi.stubGlobal("navigator", { onLine: false })
  // Always mode exercises the callback even though normal queries pause offline.
  await expect(
    queryClient.fetchQuery({
      queryKey: keys.chatRooms(),
      queryFn: () => Promise.reject(failure),
      retry: false,
      networkMode: "always",
    })
  ).rejects.toBe(failure)
  expect(toast.error).not.toHaveBeenCalled()
})

it("leaves missing chat resources to navigation instead of displaying a deletion error toast", async () => {
  const missing = new ApiError(
    "チャットが見つかりません。",
    404,
    "CHAT_ROOM_NOT_FOUND"
  )
  await Promise.all(
    [
      "chat-room",
      "chat-messages",
      "chat-settings",
      "chat-members",
      "chat-image-message",
    ].map((root) =>
      expect(
        queryClient.fetchQuery({
          queryKey: [root, "removed"],
          queryFn: () => Promise.reject(missing),
          retry: false,
        })
      ).rejects.toBe(missing)
    )
  )
  expect(toast.error).not.toHaveBeenCalled()
  await expect(
    queryClient.fetchQuery({
      queryKey: ["activity", "missing"],
      queryFn: () => Promise.reject(missing),
      retry: false,
    })
  ).rejects.toBe(missing)
  expect(toast.error).toHaveBeenCalledTimes(1)
})
