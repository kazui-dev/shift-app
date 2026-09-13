import * as v from "valibot"
import { chatLinkPreviewSchema } from "@workspace/shared/communications"
import { previewText } from "../domain/link-preview"
import { fetchLink, limitedBody, publicLink, urlDigest } from "./link-fetch"
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
    const text = previewText(meta, title, url.hostname)
    if (!text) return null
    let image: string | null = null
    if (text.image) {
      try {
        image = publicLink(new URL(text.image, url).href).href
      } catch {
        image = null
      }
    }
    return { ...text, url: value, image }
  } catch {
    return null
  }
}
export async function cachedLinkPreview(
  value: string,
  origin: string,
  waitUntil: (work: Promise<unknown>) => void
) {
  const key = new Request(
    `${origin}/__link-preview/v2/${await urlDigest(value)}`
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
