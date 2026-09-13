import * as v from "valibot"

const dnsSchema = v.object({
  Answer: v.optional(
    v.array(v.object({ type: v.number(), data: v.string() })),
    []
  ),
})
export function publicLink(value: string) {
  const url = new URL(value)
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    value.length > 2048 ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host)
  )
    throw new Error("Non-public URL")
  url.hostname = host
  url.hash = ""
  return url
}
function publicAddress(address: string) {
  if (address.includes(":"))
    return (
      /^[23][\da-f]{3}:/i.test(address) &&
      !/^2001:(?:0*:|0?(?:[01][\da-f]|db8):)/i.test(address)
    )
  const parts = address.split(".").map(Number)
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false
  const [a, b, c] = parts
  return (
    a !== undefined &&
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    !(a === 100 && b !== undefined && b >= 64 && b <= 127) &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b !== undefined && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
    !(a === 203 && b === 0 && c === 113)
  )
}
async function checkDns(host: string, signal: AbortSignal) {
  const replies = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
        { headers: { Accept: "application/dns-json" }, signal }
      )
      if (!response.ok) throw new Error("DNS unavailable")
      return v
        .parse(dnsSchema, await response.json())
        .Answer.filter((record) => record.type === 1 || record.type === 28)
    })
  )
  const addresses = replies.flat()
  if (
    !addresses.length ||
    addresses.some((record) => !publicAddress(record.data))
  )
    throw new Error("Non-public address")
}
export async function fetchLink(
  value: string,
  accept: string,
  signal: AbortSignal
) {
  async function visit(
    url: URL,
    remaining: number
  ): Promise<{ response: Response; url: URL }> {
    if (!remaining) throw new Error("Too many redirects")
    await checkDns(url.hostname, signal)
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { Accept: accept, "User-Agent": "ShiftApp-LinkPreview/1.0" },
    })
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      const next = response.headers.get("location")
      if (!next) throw new Error("Missing redirect")
      return visit(publicLink(new URL(next, url).href), remaining - 1)
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error("Preview unavailable")
    }
    return { response, url }
  }
  return visit(publicLink(value), 4)
}
export async function limitedBody(response: Response, limit: number) {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel()
    throw new Error("Preview too large")
  }
  const chunks: Uint8Array[] = []
  let size = 0
  await response.body?.pipeTo(
    new WritableStream<Uint8Array>({
      write(chunk) {
        size += chunk.length
        if (size > limit) throw new Error("Preview too large")
        chunks.push(chunk)
      },
    })
  )
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
