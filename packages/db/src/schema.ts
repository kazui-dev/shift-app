import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})