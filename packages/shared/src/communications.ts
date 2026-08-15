import { z } from "zod"

import { instantSchema, operatingYearSchema } from "./shifts"

export const createAnnouncementInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(["normal", "important"]).default("normal"),
  expiresAt: instantSchema.nullable().default(null),
})

export const announcementResponseSchema = z.object({
  id: z.string().uuid(),
  year: operatingYearSchema,
  title: z.string(),
  body: z.string(),
  priority: z.enum(["normal", "important"]),
  publishedAt: instantSchema,
  expiresAt: instantSchema.nullable(),
  authorDisplayName: z.string(),
})

export const announcementEnvelopeSchema = z.object({
  announcement: announcementResponseSchema,
})

export const announcementsResponseSchema = z.object({
  announcements: z.array(announcementResponseSchema),
})
