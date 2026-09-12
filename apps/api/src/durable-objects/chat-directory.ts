import type { ChatEvent } from "@workspace/shared/communications"
import { DurableObject } from "cloudflare:workers"

export class ChatDirectory extends DurableObject<CloudflareBindings> {
  accessChanged() {
    for (const socket of this.ctx.getWebSockets())
      this.deliver(socket, { type: "access_changed" })
  }
  private deliver(socket: WebSocket, event: ChatEvent) {
    try {
      socket.send(JSON.stringify(event))
    } catch {
      socket.close(1011, "Delivery failed")
    }
  }
  publish(memberIds: string[], event: ChatEvent) {
    const recipients = new Set(memberIds)
    for (const socket of this.ctx.getWebSockets()) {
      const member: unknown = socket.deserializeAttachment()
      if (typeof member !== "string" || !recipients.has(member)) continue
      this.deliver(socket, event)
    }
  }
  override fetch(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("Expected WebSocket", { status: 426 })
    const member = request.headers.get("X-Chat-Member-Id")
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
