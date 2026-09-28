import * as v from "valibot"
import { chatLinkPreviewSchema } from "@workspace/shared/communications"
import { previewText } from "../domain/link-preview"
import { fetchLink, limitedBody, publicLink, type OwnSite } from "./link-fetch"
type Preview = v.InferOutput<typeof chatLinkPreviewSchema>["preview"]
const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]
/** What a public page says about itself, or `null` when it cannot be read. */
export async function loadLinkPreview(
  value: string,
  site?: OwnSite
): Promise<Preview> {
  try {
    const { response, url } = await fetchLink(
      value,
      "text/html",
      // Cards are made after sending, so a slow page may take its time.
      AbortSignal.timeout(10_000),
      site
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
/**
 * A link card's image: the page's image cropped to the card's square as WebP,
 * or `null` when it is not a readable image.
 */
export async function loadLinkImage(
  images: Pick<ImagesBinding, "info" | "input">,
  value: string,
  site?: OwnSite
) {
  try {
    const { response } = await fetchLink(
      value,
      "image/avif,image/webp,image/png,image/jpeg,image/gif",
      AbortSignal.timeout(10_000),
      site
    )
    const bytes = await limitedBody(response, 20 * 1024 * 1024)
    const info = await images.info(new Blob([bytes]).stream())
    if (
      !("width" in info) ||
      !imageTypes.includes(info.format) ||
      info.width * info.height > 100_000_000
    )
      return null
    const result = await images
      .input(new Blob([bytes]).stream())
      .transform({ width: 336, height: 336, fit: "cover" })
      .output({ format: "image/webp", quality: 85, anim: false })
    return await result.response().arrayBuffer()
  } catch {
    return null
  }
}
