import { afterEach, expect, it, vi } from "vite-plus/test"
import {
  fetchLink,
  limitedBody,
  publicLink,
} from "../../src/features/chat/services/link-fetch"
afterEach(() => vi.unstubAllGlobals())
it("rejects private names, literal addresses, credentials and unexpected protocols/ports", () => {
  for (const url of [
    "http://127.1",
    "http://2130706433",
    "http://[::1]",
    "http://localhost",
    "http://a.local",
    "file:///etc/passwd",
    "https://u:p@example.com",
    "https://example.com:444",
  ])
    expect(() => publicLink(url)).toThrow()
  expect(publicLink("https://example.com./a#b").href).toBe(
    "https://example.com/a"
  )
})
it("checks resolved addresses before fetching any page", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () =>
      Response.json({ Answer: [{ type: 1, data: "10.0.0.1" }] })
    )
  vi.stubGlobal("fetch", request)
  await expect(
    fetchLink("https://example.com", "text/html", new AbortController().signal)
  ).rejects.toThrow("Non-public address")
  expect(
    request.mock.calls.every(([url]) =>
      (typeof url === "string"
        ? url
        : url instanceof URL
          ? url.href
          : url.url
      ).startsWith("https://cloudflare-dns.com/")
    )
  ).toBe(true)
})
it("revalidates redirects without sending credentials to the target", async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async (url) =>
    (typeof url === "string"
      ? url
      : url instanceof URL
        ? url.href
        : url.url
    ).includes("dns-query")
      ? Response.json({ Answer: [{ type: 1, data: "93.184.215.14" }] })
      : new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/private" },
        })
  )
  vi.stubGlobal("fetch", request)
  await expect(
    fetchLink("https://example.com", "text/html", new AbortController().signal)
  ).rejects.toThrow("Non-public URL")
  expect(request).toHaveBeenCalledTimes(3)
})
it("limits streamed bodies even without a content length", async () => {
  await expect(limitedBody(new Response("12345"), 4)).rejects.toThrow(
    "too large"
  )
  expect(
    new TextDecoder().decode(await limitedBody(new Response("1234"), 4))
  ).toBe("1234")
})
