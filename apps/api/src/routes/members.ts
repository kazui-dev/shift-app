import { Hono } from "hono"
import * as v from "valibot"

import { apiError, errors } from "../lib/errors"
import type { ApiEnv } from "../lib/http"
import { avatarKey } from "../services/avatar"

export const membersApp = new Hono<ApiEnv>()

const memberIdSchema = v.pipe(v.string(), v.uuid())

/** A member's stored profile image, readable by any onboarded member. */
membersApp.get("/:memberId/avatar", async (c) => {
  const memberId = c.req.param("memberId")
  if (!v.is(memberIdSchema, memberId)) {
    return apiError(c, errors.routeNotFound)
  }

  const object = await c.env.CHAT_IMAGES.get(avatarKey(memberId))
  if (!object) {
    c.header("Cache-Control", "no-store")
    return c.body(null, 404)
  }

  // A new upload replaces the object at the same path, so the copy a browser
  // keeps must go stale quickly; the ETag settles the rest.
  c.header("Cache-Control", "private, max-age=60")
  c.header("ETag", object.httpEtag)
  c.header("Content-Type", "image/webp")
  c.header("Cross-Origin-Resource-Policy", "same-origin")
  c.header("X-Content-Type-Options", "nosniff")
  return c.body(object.body)
})
