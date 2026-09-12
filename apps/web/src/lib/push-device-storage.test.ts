import { afterEach, expect, it, vi } from "vite-plus/test"
import { readPushDeviceId, savePushDeviceId } from "./push-device-storage"
afterEach(() => vi.unstubAllGlobals())
it("stores only the stable owner/id, discarding corrupt or invalid records", () => {
  let stored: string | null = null
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value
    },
  })
  expect(readPushDeviceId()).toBeNull()
  savePushDeviceId("user", "11111111-1111-4111-8111-111111111111")
  expect(readPushDeviceId()).toEqual({
    owner: "user",
    id: "11111111-1111-4111-8111-111111111111",
  })
  stored = "{"
  expect(readPushDeviceId()).toBeNull()
  stored = '{"owner":"user","id":"invalid"}'
  expect(readPushDeviceId()).toBeNull()
})
