import * as v from "valibot"
const key = "shift-app:push-device"
const recordSchema = v.object({
  owner: v.string(),
  id: v.pipe(v.string(), v.uuid()),
})
export function readPushDeviceId() {
  const value = localStorage.getItem(key)
  if (!value) return null
  try {
    const parsed = v.safeParse(recordSchema, JSON.parse(value))
    return parsed.success ? parsed.output : null
  } catch {
    return null
  }
}
export function savePushDeviceId(owner: string, id: string) {
  localStorage.setItem(key, JSON.stringify({ owner, id }))
}
