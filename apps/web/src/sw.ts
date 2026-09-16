/// <reference lib="webworker" />
import {
  PrecacheController,
  PrecacheRoute,
  type PrecacheEntry,
} from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"

declare const self: ServiceWorkerGlobalScope & {
  precacheManifest: PrecacheEntry[]
}

self.importScripts("/push-sw.js")
const entries = self.precacheManifest
const cache = new PrecacheController()
cache.addToCacheList(entries)

// Bound network concurrency without changing Workbox's revision keys or cache.
// Only the complete manifest may clean up: a partial controller would delete
// the other installers' entries.
self.addEventListener("install", (event) => {
  const installers = Array.from({ length: 6 }, (_value, index) => {
    const installer = new PrecacheController()
    installer.addToCacheList(
      entries.filter((_, position) => position % 6 === index)
    )
    return installer.install(event)
  })
  event.waitUntil(
    Promise.all(installers).then(async () => {
      // Versions share one cache, and an older one activating meanwhile deletes
      // entries this one has just stored. Fail so the browser installs again.
      const stored = await caches.open(cache.strategy.cacheName)
      for (const key of cache.getURLsToCacheKeys().values())
        if (!(await stored.match(key)))
          throw new Error(`Precache entry missing: ${key}`)
    })
  )
})
self.addEventListener("activate", (event) => {
  event.waitUntil(cache.activate(event))
})
self.addEventListener("message", (event) => {
  const data: unknown = event.data
  if (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "SKIP_WAITING"
  )
    event.waitUntil(self.skipWaiting())
})
registerRoute(new PrecacheRoute(cache))
// Missing the shell, ask for the page itself: the server answers /index.html
// with a redirect, and a navigation must never be answered by a redirected
// response, which the browser shows as a failed connection.
registerRoute(
  new NavigationRoute(
    async ({ request }) =>
      (await cache.matchPrecache("/index.html")) ?? fetch(request),
    { denylist: [/^\/api\//] }
  )
)
