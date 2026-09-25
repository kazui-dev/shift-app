import { decodeHTML } from "entities"

/** Reads what a page says about itself, preferring Open Graph over plain HTML. */
export function previewText(
  meta: ReadonlyMap<string, string>,
  title: string,
  hostname: string
) {
  const read = (...names: string[]) =>
    decodeHTML(names.map((name) => meta.get(name)).find(Boolean) ?? "").trim()
  const name = (
    read("og:title", "twitter:title") || decodeHTML(title).trim()
  ).slice(0, 200)
  if (!name) return null
  return {
    title: name,
    description: read(
      "og:description",
      "description",
      "twitter:description"
    ).slice(0, 300),
    site: (read("og:site_name") || hostname).slice(0, 100),
    image: read("og:image", "twitter:image") || null,
  }
}
