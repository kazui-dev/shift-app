import type { DataEvent, LiveEvent } from "@workspace/shared/live"
import { DurableObject } from "cloudflare:workers"

/**
 * Holds every member's live connection, for chat and for other changes alike.
 * The class keeps its original name because Durable Object classes are
 * persistent identities; see docs/compatibility.md before renaming it.
 */
export class ChatDirectory extends DurableObject<CloudflareBindings> {
  broadcast(event: DataEvent) {
    const message = JSON.stringify(event)
    for (const socket of this.ctx.getWebSockets()) this.deliver(socket, message)
  }
  private deliver(socket: WebSocket, message: string) {
    try {
      socket.send(message)
    } catch {
      socket.close(1011, "Delivery failed")
    }
  }
  publish(memberIds: string[], event: LiveEvent) {
    const recipients = new Set(memberIds)
    const message = JSON.stringify(event)
    for (const socket of this.ctx.getWebSockets()) {
      const member: unknown = socket.deserializeAttachment()
      if (typeof member !== "string" || !recipients.has(member)) continue
      this.deliver(socket, message)
    }
  }
  override fetch(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("Expected WebSocket", { status: 426 })
    const member = request.headers.get("X-Member-Id")
    if (!member) return new Response("Unauthorized", { status: 401 })
    const [client, server] = Object.values(new WebSocketPair())
    if (!client || !server)
      return new Response("WebSocket unavailable", { status: 500 })
    server.serializeAttachment(member)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }
  override webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") socket.send("pong")
  }
  override webSocketError(socket: WebSocket) {
    socket.close(1011, "WebSocket error")
  }
}
