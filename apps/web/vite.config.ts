import path from "path"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig, lazyPlugins } from "vite-plus"
import { VitePWA } from "vite-plugin-pwa"

const plugins = lazyPlugins(() => [
  tanstackRouter({
    target: "react",
    autoCodeSplitting: true,
  }),
  react(),
  tailwindcss(),
  VitePWA({
    registerType: "autoUpdate",
    manifest: {
      name: "旭祭シフト",
      short_name: "旭祭シフト",
      description: "旭祭実行委員会向けのシフト管理アプリ",
      lang: "ja",
      theme_color: "#171717",
      background_color: "#ffffff",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/app-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    workbox: {
      importScripts: ["/push-sw.js"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//],
    },
  }),
  cloudflare({
    configPath: "../api/wrangler.jsonc",
  }),
])

// https://vite.dev/config/
export default defineConfig({
  ...(plugins === undefined ? {} : { plugins }),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: { host: true },
})
