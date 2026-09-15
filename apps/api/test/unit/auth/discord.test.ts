import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { getDiscordUserInfo } from "../../../src/auth/discord"

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
  ).toBe("https://cdn.discordapp.com/avatars/4194304/new_hash.webp?size=128")
  expect(
    (await getDiscordUserInfo({ accessToken: "token" }, "guild"))?.user.image
  ).toBe("")
})
