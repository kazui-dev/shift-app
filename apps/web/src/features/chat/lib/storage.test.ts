import { get } from "idb-keyval"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { loadChat } from "@/features/chat/lib/storage"

vi.mock("idb-keyval", () => ({
  clear: vi.fn<() => Promise<void>>(),
  createStore: vi.fn<() => unknown>(),
  get: vi.fn<typeof get>(),
  getMany: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  promisifyRequest: vi.fn<() => Promise<unknown>>(),
}))

beforeEach(() => {
  vi.mocked(get).mockReset()
})

it("drops a saved chat from an older version instead of failing to load", async () => {
  vi.mocked(get).mockResolvedValueOnce({ version: 4, drafts: {}, queue: [] })
  await expect(loadChat("member")).resolves.toBeUndefined()
})

it("restores a saved chat of the current version", async () => {
  vi.mocked(get).mockResolvedValueOnce({
    version: 5,
    drafts: {},
    queue: [],
    originals: [],
  })
  await expect(loadChat("member")).resolves.toEqual({
    version: 5,
    drafts: {},
    queue: [],
    originals: [],
  })
})
