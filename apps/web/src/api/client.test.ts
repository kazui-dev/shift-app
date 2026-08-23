import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import * as v from "valibot"

import { ApiError, ApiNetworkError, apiJson, errorMessage } from "./client"

afterEach(() => vi.unstubAllGlobals())

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
