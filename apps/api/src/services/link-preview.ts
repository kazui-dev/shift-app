import * as v from "valibot"
import { chatLinkPreviewSchema } from "@workspace/shared/communications"
import { fetchLink, limitedBody, publicLink } from "./link-fetch"
type Preview = v.InferOutput<typeof chatLinkPreviewSchema>["preview"]
async function loadLinkPreview(value: string): Promise<Preview> {
  try {
    const { response, url } = await fetchLink(
      value,
      "text/html",
      AbortSignal.timeout(5000)
    )
    if (!response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel()
      return null
    }
    const bytes = await limitedBody(response, 512 * 1024)
    const meta = new Map<string, string>()
    let title = ""
    const parser = new HTMLRewriter()
      .on("meta", {
        element(element) {
          const name = (
            element.getAttribute("property") ?? element.getAttribute("name")
          )?.toLowerCase()
          const content = element.getAttribute("content")
          if (name && content && !meta.has(name))
            meta.set(name, content.trim().slice(0, 2048))
        },
      })
      .on("title", {
        text(chunk) {
          title = (title + chunk.text).slice(0, 300)
        },
      })
    await parser
      .transform(
        new Response(bytes, {
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      )
      .arrayBuffer()
    const name = (meta.get("og:title") || meta.get("twitter:title") || title)
      .trim()
      .slice(0, 200)
    if (!name) return null
    let image: string | null = null
    const source = meta.get("og:image") || meta.get("twitter:image")
    if (source) {
      try {
        image = publicLink(new URL(source, url).href).href
      } catch {
        image = null
      }
    }
    return {
      url: value,
      title: name,
      description: (
        meta.get("og:description") ||
        meta.get("description") ||
        meta.get("twitter:description") ||
        ""
      ).slice(0, 300),
      site: (meta.get("og:site_name") || url.hostname).slice(0, 100),
      image,
    }
  } catch {
    return null
  }
}
export async function cachedLinkPreview(
  value: string,
  origin: string,
  waitUntil: (work: Promise<unknown>) => void
) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  const key = new Request(
    `${origin}/__link-preview/v1/${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  )
  const cache = await caches.open("chat-link-previews")
  const cached = await cache.match(key)
  if (cached) {
    const parsed = v.safeParse(chatLinkPreviewSchema, await cached.json())
    if (parsed.success) return parsed.output.preview
  }
  const preview = await loadLinkPreview(value)
  waitUntil(
    cache.put(
      key,
      Response.json(
        { preview },
        {
          headers: {
            "Cache-Control": `public, max-age=${preview ? 86400 : 300}`,
          },
        }
      )
    )
  )
  return preview
}
