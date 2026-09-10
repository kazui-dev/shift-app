import * as v from "valibot"

const storageKey = "shift-app:push-intent"
const intentLifetime = 2 * 60 * 1000

const intentSchema = v.object({
  owner: v.string(),
  enabled: v.boolean(),
  expiresAt: v.number(),
})

type IntentStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

function removeIntent(storage: IntentStorage): void {
  try {
    storage.removeItem(storageKey)
  } catch {
    // Storage availability must not block notification controls.
  }
}

export function loadPushControlIntent(
  storage: IntentStorage,
  owner: string,
  now = Date.now()
): boolean | null {
  try {
    const value = storage.getItem(storageKey)
    if (value === null) return null
    const input: unknown = JSON.parse(value)
    const parsed = v.safeParse(intentSchema, input)
    if (!parsed.success || parsed.output.expiresAt <= now) {
      removeIntent(storage)
      return null
    }
    return parsed.output.owner === owner ? parsed.output.enabled : null
  } catch {
    removeIntent(storage)
    return null
  }
}

export function savePushControlIntent(
  storage: IntentStorage,
  owner: string,
  enabled: boolean,
  now = Date.now()
): void {
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({ owner, enabled, expiresAt: now + intentLifetime })
    )
  } catch {
    // Storage availability must not block notification controls.
  }
}

export function clearPushControlIntent(
  storage: IntentStorage,
  owner: string
): void {
  try {
    const value = storage.getItem(storageKey)
    if (value === null) return
    const input: unknown = JSON.parse(value)
    const parsed = v.safeParse(intentSchema, input)
    if (!parsed.success || parsed.output.owner === owner) {
      removeIntent(storage)
    }
  } catch {
    removeIntent(storage)
  }
}
