import { app } from "./app"
import { sendDueAssignmentReminders } from "./services/push"

export { ChatRoom } from "./durable-objects/chat-room"

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (controller, env, ctx) => {
    ctx.waitUntil(sendDueAssignmentReminders(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<CloudflareBindings>
