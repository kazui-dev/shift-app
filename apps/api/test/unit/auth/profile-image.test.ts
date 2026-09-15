import { expect, it } from "vite-plus/test"

import { normalizeProfileImage } from "../../../src/auth/profile-image"

const site = "https://shift.example.test"
const own = `${site}/api/members/3f3f6a2e-4c7b-4f1e-9a2f-6a1b2c3d4e5f/avatar?v=1789200000000`

it("keeps an allowed image and clears an empty one without touching other fields", () => {
  expect(normalizeProfileImage({ name: "Member", image: "" }, site)).toEqual({
    name: "Member",
    image: null,
  })
  expect(
    normalizeProfileImage(
      { image: "https://cdn.discordapp.com/avatars/123/hash.webp?size=128" },
      site
    )
  ).toEqual({
    image: "https://cdn.discordapp.com/avatars/123/hash.webp?size=128",
  })
  expect(normalizeProfileImage({ image: own }, site)).toEqual({ image: own })
  expect(
    normalizeProfileImage({ name: "Member", image: undefined }, site)
  ).toEqual({ name: "Member", image: undefined })
})

it.each([
  "https://cdn.discordapp.com/embed/avatars/0.png",
  "https://example.com/avatar.png",
  `https://attacker.example/api/members/3f3f6a2e-4c7b-4f1e-9a2f-6a1b2c3d4e5f/avatar`,
  `${site}/api/members/not-a-uuid/avatar`,
  `${site}/api/members/3f3f6a2e-4c7b-4f1e-9a2f-6a1b2c3d4e5f/avatar?v=x`,
])("does not persist an image from anywhere else: %s", (image) => {
  expect(normalizeProfileImage({ image }, site)).toEqual({ image: null })
})
