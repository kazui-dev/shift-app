import { sql } from "drizzle-orm"
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { appUsers } from "./account"
import { operatingYears } from "./organization"

export const yearTags = sqliteTable(
  "year_tags",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("year_tags_year_name_nocase_uidx").on(
      table.year,
      sql`lower(${table.name})`
    ),
  ]
)

export const memberYearTags = sqliteTable(
  "member_year_tags",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => yearTags.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.tagId] }),
    index("member_year_tags_tag_idx").on(table.tagId),
  ]
)
