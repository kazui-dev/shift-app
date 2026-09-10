import { describe, expect, it } from "vite-plus/test"

import {
  clearPushControlIntent,
  loadPushControlIntent,
  savePushControlIntent,
} from "./push-control-intent"

function memoryStorage(): Pick<Storage, "getItem" | "removeItem" | "setItem"> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

describe("push control intent", () => {
  it("restores a current intent only for its owner", () => {
    const storage = memoryStorage()
    savePushControlIntent(storage, "26AJ001", true, 1_000)

    expect(loadPushControlIntent(storage, "26AJ001", 2_000)).toBe(true)
    expect(loadPushControlIntent(storage, "26AJ002", 2_000)).toBeNull()
  })

  it("discards an expired intent", () => {
    const storage = memoryStorage()
    savePushControlIntent(storage, "26AJ001", true, 1_000)

    expect(loadPushControlIntent(storage, "26AJ001", 121_001)).toBeNull()
    expect(loadPushControlIntent(storage, "26AJ001", 2_000)).toBeNull()
  })

  it("does not clear another owner's intent", () => {
    const storage = memoryStorage()
    savePushControlIntent(storage, "26AJ001", false, 1_000)

    clearPushControlIntent(storage, "26AJ002")

    expect(loadPushControlIntent(storage, "26AJ001", 2_000)).toBe(false)
  })
})
