import * as v from "valibot"

export function chatImageLocation(search: Record<string, unknown>): {
  image?: string | undefined
  message?: number | undefined
} {
  const image = v.safeParse(v.pipe(v.string(), v.uuid()), search.image)
  const message =
    typeof search.message === "number" || typeof search.message === "string"
      ? Number(search.message)
      : NaN
  return image.success &&
    Number.isSafeInteger(message) &&
    message > 0 &&
    message < Number.MAX_SAFE_INTEGER
    ? { image: image.output, message }
    : {}
}
