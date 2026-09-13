import { WorkerEntrypoint } from "cloudflare:workers"

import { sharedApp } from "../routes/shared"

/**
 * Serves responses every member shares, with Workers Cache in front. Its cache
 * key is the request path alone, so only routes that have already authorized
 * the member reach it, through `lib/shared-cache`.
 */
export class SharedCache extends WorkerEntrypoint<CloudflareBindings> {
  override fetch(request: Request) {
    return sharedApp.fetch(request, this.env, this.ctx)
  }
}
