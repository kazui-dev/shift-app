import { expect, it } from "vite-plus/test"
import { canSubmit } from "@/features/chat/components/composer/send-rule"

const image = { id: "image", name: "image.png", blob: new Blob() }

it("sends a new message with text or waiting images", () => {
  expect(canSubmit({ content: " ", files: [] }, undefined)).toBe(false)
  expect(canSubmit({ content: "本文", files: [] }, undefined)).toBe(true)
  expect(canSubmit({ content: "", files: [image] }, undefined)).toBe(true)
})

it("saves an edit from its text, ignoring images waiting in the draft", () => {
  expect(canSubmit({ content: "", files: [image] }, { hasImages: false })).toBe(
    false
  )
  expect(canSubmit({ content: "本文", files: [] }, { hasImages: false })).toBe(
    true
  )
  expect(canSubmit({ content: "", files: [] }, { hasImages: true })).toBe(true)
})
