import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import {
  getDiscordUserInfo,
  normalizeProfileImage,
} from "../../../src/auth/providers"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getDiscordUserInfo", () => {
  it("accepts a user who belongs to the configured guild", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          id: "123",
          username: "member",
          global_name: "Member",
          avatar: null,
        })
      )
      .mockResolvedValueOnce(Response.json({ roles: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getDiscordUserInfo({ accessToken: "token" }, "guild")
    ).resolves.toMatchObject({
      user: {
        id: "123",
        email: "discord-123@identity.invalid",
      },
    })
  })

  it("rejects a user who is not in the configured guild", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "123", username: "member" }))
      .mockResolvedValueOnce(Response.json({}, { status: 404 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getDiscordUserInfo({ accessToken: "token" }, "guild")
    ).resolves.toBeNull()
  })
})

it("returns the current Discord avatar and explicitly clears a removed avatar", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ id: "4194304", username: "member", avatar: "new_hash" })
    )
    .mockResolvedValueOnce(Response.json({ roles: [] }))
    .mockResolvedValueOnce(
      Response.json({ id: "4194304", username: "member", avatar: null })
    )
    .mockResolvedValueOnce(Response.json({ roles: [] }))
  vi.stubGlobal("fetch", fetchMock)
  expect(
    (await getDiscordUserInfo({ accessToken: "token" }, "guild"))?.user.image
  ).toBe("https://cdn.discordapp.com/avatars/4194304/new_hash.png")
  expect(
    (await getDiscordUserInfo({ accessToken: "token" }, "guild"))?.user.image
  ).toBe("")
})

it("clears an empty OAuth image at persistence without changing other profile fields", () => {
  expect(normalizeProfileImage({ name: "Member", image: "" })).toEqual({
    name: "Member",
    image: null,
  })
  expect(
    normalizeProfileImage({
      image: "https://cdn.discordapp.com/avatars/123/hash.png",
    })
  ).toEqual({ image: "https://cdn.discordapp.com/avatars/123/hash.png" })
  expect(normalizeProfileImage({ name: "Member", image: undefined })).toEqual({
    name: "Member",
    image: undefined,
  })
})

it.each([
  "https://cdn.discordapp.com/embed/avatars/0.png",
  "https://example.com/avatar.png",
])("does not persist a default or external avatar: %s", (image) => {
  expect(normalizeProfileImage({ image })).toEqual({ image: null })
})
