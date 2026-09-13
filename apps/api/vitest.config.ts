import { defineConfig } from "vite-plus"

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": new URL(
        "./test/support/cloudflare-workers.ts",
        import.meta.url
      ).pathname,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
