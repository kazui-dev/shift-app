import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: [
    "../../packages/db/src/auth-schema.ts",
    "../../packages/db/src/schema.ts",
  ],
  out: "./migrations",
})
