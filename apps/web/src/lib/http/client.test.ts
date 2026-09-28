import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import * as v from "valibot"

import {
  ApiError,
  ApiNetworkError,
  apiJson,
  apiUpload,
  errorMessage,
} from "./client"

afterEach(() => vi.unstubAllGlobals())

type Listener = (event: {
  lengthComputable: boolean
  loaded: number
  total: number
}) => void

/** Stands in for XMLHttpRequest, letting a test drive each upload event. */
class FakeRequest {
  static last: FakeRequest | undefined
  status = 0
  responseText = ""
  url = ""
  headers = new Map<string, string>()
  body: unknown
  listeners = new Map<string, Listener>()
  upload = {
    listeners: new Map<string, Listener>(),
    addEventListener(type: string, listener: Listener) {
      this.listeners.set(type, listener)
    },
  }
  constructor() {
    FakeRequest.last = this
  }
  open(_method: string, url: string) {
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value)
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener)
  }
  send(body: unknown) {
    this.body = body
  }
  abort() {
    this.fire("abort")
  }
  fire(type: string) {
    this.listeners.get(type)?.({ lengthComputable: false, loaded: 0, total: 0 })
  }
}
const sent = () => {
  if (!FakeRequest.last) throw Error("No upload started")
  return FakeRequest.last
}
const schema = v.object({ id: v.string() })

describe("uploads", () => {
  it("reports how much is sent and parses the created resource", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeRequest)
    const progress = vi.fn<(sent: number, total: number) => void>()
    const upload = apiUpload(
      "/api/upload",
      schema,
      new Blob(["abc"], { type: "image/png" }),
      { onProgress: progress }
    )
    const request = sent()
    expect(request.headers.get("Content-Type")).toBe("image/png")
    request.upload.listeners.get("progress")?.({
      lengthComputable: true,
      loaded: 1,
      total: 3,
    })
    request.upload.listeners.get("progress")?.({
      lengthComputable: false,
      loaded: 0,
      total: 0,
    })
    request.status = 201
    request.responseText = JSON.stringify({ id: "created" })
    request.fire("load")
    await expect(upload).resolves.toEqual({ id: "created" })
    expect(progress).toHaveBeenCalledExactlyOnceWith(1, 3)
  })

  it("fails like other requests on an error response, a lost connection or cancellation", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeRequest)
    const body = new Blob(["abc"])
    const rejected = apiUpload("/api/upload", schema, body)
    const request = sent()
    expect(request.headers.get("Content-Type")).toBe("application/octet-stream")
    request.status = 429
    request.responseText = JSON.stringify({
      error: { code: "IMAGE_LIMIT", message: "上限です" },
    })
    request.fire("load")
    await expect(rejected).rejects.toMatchObject({
      status: 429,
      code: "IMAGE_LIMIT",
    })

    const lost = apiUpload("/api/upload", schema, body)
    sent().fire("error")
    await expect(lost).rejects.toBeInstanceOf(ApiNetworkError)

    const controller = new AbortController()
    const cancelled = apiUpload("/api/upload", schema, body, {
      signal: controller.signal,
    })
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" })
    await expect(
      apiUpload("/api/upload", schema, body, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" })
  })

  it("fails like a lost connection once an upload stops making progress", async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal("XMLHttpRequest", FakeRequest)
      const stalled = apiUpload("/api/upload", schema, new Blob(["abc"]))
      const request = sent()
      let settled = false
      const rejection = stalled.catch((error: unknown) => {
        settled = true
        return error
      })
      await vi.advanceTimersByTimeAsync(30_000)
      request.upload.listeners.get("progress")?.({
        lengthComputable: true,
        loaded: 1,
        total: 3,
      })
      await vi.advanceTimersByTimeAsync(44_999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(await rejection).toBeInstanceOf(ApiNetworkError)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("API failures", () => {
  it("distinguishes a network failure from an HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("offline")
      })
    )

    await expect(apiJson("/api/account", v.unknown())).rejects.toBeInstanceOf(
      ApiNetworkError
    )
  })

  it("preserves structured authorization errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          },
          { status: 401 }
        )
      )
    )

    const request = apiJson("/api/account", v.unknown())
    await expect(request).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    })
    await expect(request).rejects.toBeInstanceOf(ApiError)
  })

  it("shows a useful message for network failures", () => {
    expect(errorMessage(new ApiNetworkError(new TypeError("offline")))).toBe(
      "通信に失敗しました。"
    )
  })
})
