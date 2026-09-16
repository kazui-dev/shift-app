import * as v from "valibot"

import { chatEventSchema } from "./communications"

const idSchema = v.pipe(v.string(), v.uuid())

/**
 * Changes outside chat, announced to every connected device. They name what
 * changed and carry no private data: each client refetches what it holds
 * through the authorized API.
 */
export const dataEventSchema = v.variant("type", [
  /** Roles, memberships or year settings changed what members may see. */
  v.object({ type: v.literal("access_changed") }),
  /** A shift was created, edited, copied or deleted, with its assignments. */
  v.object({ type: v.literal("shifts_changed") }),
  v.object({ type: v.literal("attendance_changed"), activityId: idSchema }),
  /** The dates members are asked about changed. */
  v.object({
    type: v.literal("availability_changed"),
    year: v.pipe(v.number(), v.integer()),
  }),
  /** A member answered, which only changes who has submitted. */
  v.object({
    type: v.literal("availability_submitted"),
    year: v.pipe(v.number(), v.integer()),
  }),
  v.object({
    type: v.literal("profile_changed"),
    memberId: idSchema,
    image: v.nullable(v.pipe(v.string(), v.url())),
  }),
])
export type DataEvent = v.InferOutput<typeof dataEventSchema>

/** Everything the live connection delivers. */
export const liveEventSchema = v.variant("type", [
  chatEventSchema,
  dataEventSchema,
])
export type LiveEvent = v.InferOutput<typeof liveEventSchema>
