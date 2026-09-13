import { expect, it } from "vite-plus/test"
import { previewText } from "../../src/domain/link-preview"

it("decodes character references in page metadata", () => {
  expect(
    previewText(
      new Map([
        ["og:title", "Tom&#x27;s &amp; Jerry&apos;s"],
        ["og:description", "&lt;b&gt; &#12354;"],
        ["og:site_name", "Site&nbsp;Name"],
        ["og:image", "/a.png?x=1&amp;y=2"],
      ]),
      "",
      "example.com"
    )
  ).toEqual({
    title: "Tom's & Jerry's",
    description: "<b> あ",
    site: "Site Name",
    image: "/a.png?x=1&y=2",
  })
})

it("falls back from Open Graph to other metadata and the page title", () => {
  expect(
    previewText(
      new Map([
        ["twitter:title", "Twitter"],
        ["description", "Plain"],
        ["twitter:image", "/t.png"],
      ]),
      "Page",
      "example.com"
    )
  ).toEqual({
    title: "Twitter",
    description: "Plain",
    site: "example.com",
    image: "/t.png",
  })
  expect(
    previewText(new Map(), " Page &#x27;title&#x27; ", "example.com")
  ).toEqual({
    title: "Page 'title'",
    description: "",
    site: "example.com",
    image: null,
  })
})

it("has no preview without any title", () => {
  expect(previewText(new Map(), "  ", "example.com")).toBeNull()
})
