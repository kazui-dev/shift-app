import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
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
    queryKey: ["chat-rooms"],
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
      queryKey: ["chat-rooms"],
      queryFn: () => Promise.reject(failure),
      retry: false,
      networkMode: "always",
    })
  ).rejects.toBe(failure)
  expect(toast.error).not.toHaveBeenCalled()
})
