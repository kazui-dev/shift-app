import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"

import { user } from "@workspace/db"

import { apiError, errors } from "../../lib/errors"
import type { ApiEnv } from "../../lib/http"
import { avatarKey, avatarPath, storableAvatar } from "../../services/avatar"

export const meAvatarApp = new Hono<ApiEnv>()

/** Replaces the member's profile image with a square WebP of the upload. */
meAvatarApp.put("/", async (c) => {
  const member = c.get("member")
  const blob = await c.req.raw.blob()
  if (!blob.size) return apiError(c, errors.invalidImage)

  const bytes = await storableAvatar(c.env.IMAGES, blob)
  if (!bytes) return apiError(c, errors.invalidImage)

  await c.env.CHAT_IMAGES.put(avatarKey(member.id), bytes, {
    httpMetadata: { contentType: "image/webp" },
  })
  const image = `${c.env.BETTER_AUTH_URL}${avatarPath(member.id, Date.now())}`
  await drizzle(c.env.shift_app)
    .update(user)
    .set({ image, updatedAt: new Date() })
    .where(eq(user.id, member.userId))

  return c.json({ image })
})

/** Clears the member's profile image; their initial is shown again. */
meAvatarApp.delete("/", async (c) => {
  const member = c.get("member")
  await c.env.CHAT_IMAGES.delete(avatarKey(member.id))
  await drizzle(c.env.shift_app)
    .update(user)
    .set({ image: null, updatedAt: new Date() })
    .where(eq(user.id, member.userId))

  return c.body(null, 204)
})
