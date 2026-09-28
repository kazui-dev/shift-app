export { ChatDirectory } from "./features/chat/durable-objects/chat-directory"
import { cleanDeletedRooms } from "./features/chat/services/chat-cleanup"
import { app } from "./app"
import { sendDueAssignmentReminders } from "./features/notifications/services/push"

export { ChatRoom } from "./features/chat/durable-objects/chat-room"
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
