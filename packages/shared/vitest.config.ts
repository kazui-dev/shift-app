import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        statements: 85,
        branches: 55,
        functions: 50,
        lines: 85,
      },
    },
  },
})
