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
  event.waitUntil(Promise.all(installers))
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
registerRoute(
  new NavigationRoute(cache.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  })
)
