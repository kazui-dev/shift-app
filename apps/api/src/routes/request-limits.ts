import type { MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"
import { avatarLimits } from "@workspace/shared/auth"
import { chatImageLimits } from "@workspace/shared/communications"
import { apiError, errors } from "../lib/errors"

/** Requests that carry a chat image: a new upload, or a display copy's original. */
const carriesChatImage = (method: string, path: string) =>
  (method === "POST" &&
    /^\/api\/chat\/rooms\/[^/]+\/attachments$/.test(path)) ||
  (method === "PUT" &&
    /^\/api\/chat\/rooms\/[^/]+\/attachments\/[^/]+\/original$/.test(path))

/** Compose each feature's upload limit with the default JSON limit. */
const bodyLimitFor = (method: string, path: string) => {
  if (carriesChatImage(method, path)) return chatImageLimits.bytes
  if (method === "PUT" && path === "/api/me/avatar") return avatarLimits.bytes
  return 32 * 1024
}

export const limitRequestBody: MiddlewareHandler = (c, next) =>
  bodyLimit({
    maxSize: bodyLimitFor(c.req.method, c.req.path),
    onError: (context) => apiError(context, errors.bodyTooLarge),
  })(c, next)
