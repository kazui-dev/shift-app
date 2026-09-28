import type { DataEvent } from "@workspace/shared/live"

/** The one directory every live connection is held in. */
export function liveDirectory(env: CloudflareBindings) {
  return env.CHAT_DIRECTORY.getByName("rooms")
}

/** Tells every connected device that something outside chat changed. */
export async function broadcastChange(
  env: CloudflareBindings,
  event: DataEvent
) {
  await liveDirectory(env).broadcast(event)
}
