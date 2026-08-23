import path from "path"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig, lazyPlugins } from "vite-plus"
import { VitePWA } from "vite-plugin-pwa"

const plugins = lazyPlugins(() => {
  const webPlugins = [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        id: "/",
        name: "旭祭シフト",
        short_name: "旭祭シフト",
        description: "シフトの確認・提出・連絡ができるアプリ",
        lang: "ja",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        importScripts: ["/push-sw.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ]

  return process.env["VITEST"]
    ? webPlugins
    : [
        ...webPlugins,
        cloudflare({
          configPath: "../api/wrangler.jsonc",
        }),
      ]
})

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
