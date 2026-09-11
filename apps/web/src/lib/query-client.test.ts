import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { toast } from "@workspace/ui/lib/toast"
import { ApiError } from "@/api/client"
import { get } from "idb-keyval"
import { queryClient } from "./query-client"

vi.mock("idb-keyval", () => ({
  get: vi.fn<typeof get>(),
  set: vi.fn<() => Promise<void>>(),
  del: vi.fn<() => Promise<void>>(),
  createStore: () => ({}),
  clear: vi.fn<() => Promise<void>>(),
}))

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

it("upgrades cached text messages before rendering the image-capable chat", async () => {
  const { persister } = await import("./query-client")
  vi.mocked(get).mockResolvedValue({
    timestamp: Date.now(),
    buster: "",
    clientState: {
      mutations: [],
      queries: [
        {
          queryKey: ["chat-messages", "room"],
          state: {
            data: {
              pageParams: [null],
              pages: [
                {
                  hasMore: false,
                  messages: [
                    {
                      id: crypto.randomUUID(),
                      memberId: crypto.randomUUID(),
                      memberDisplayName: "メンバー",
                      content: "既存の連絡",
                      createdAt: new Date().toISOString(),
                      sequence: 1,
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  })
  const restored = await persister.restoreClient()
  expect(restored?.clientState.queries[0]?.state.data).toMatchObject({
    pages: [{ messages: [{ content: "既存の連絡", attachments: [] }] }],
  })
})
