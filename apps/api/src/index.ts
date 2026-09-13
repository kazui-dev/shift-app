export { ChatDirectory } from "./durable-objects/chat-directory"
import { cleanDeletedRooms } from "./services/chat-cleanup"
import { app } from "./app"
import { sendDueAssignmentReminders } from "./services/push"

export { ChatRoom } from "./durable-objects/chat-room"
export { SharedCache } from "./entrypoints/shared-cache"

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (controller, env, ctx) => {
    ctx.waitUntil(
      Promise.all([
        sendDueAssignmentReminders(env, controller.scheduledTime),
        cleanDeletedRooms(env),
      ])
    )
  },
} satisfies ExportedHandler<CloudflareBindings>
