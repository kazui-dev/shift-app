import path from "node:path"
import { defineConfig } from "vite-plus"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { localApi } from "./dev/local-api"

// The actual app with a memory-only API.
// No Cloudflare plugin, .dev.vars loading, API proxy, or remote binding.
export default defineConfig({
  plugins: [
    localApi(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({ registerType: "prompt", devOptions: { enabled: false } }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: { host: "127.0.0.1", port: 4178, strictPort: true },
})
