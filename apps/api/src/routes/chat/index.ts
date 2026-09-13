import { Hono } from "hono"

import type { ApiEnv } from "../../lib/http"
import { eventsApp } from "./events"
import { imagesApp } from "./images"
import { linksApp } from "./links"
import { messagesApp } from "./messages"
import { readableRoom, type RoomEnv } from "./room"
import { roomApp, roomsApp } from "./rooms"
import { settingsApp } from "./settings"
import { chatTargetsApp } from "./targets"

/** Everything addressed by a conversation, resolved once for the member. */
const conversationApp = new Hono<RoomEnv>()
conversationApp.use(readableRoom)
conversationApp.route("/", roomApp)
conversationApp.route("/", messagesApp)
conversationApp.route("/", settingsApp)
conversationApp.route("/", imagesApp)
conversationApp.route("/", linksApp)

export const chatApp = new Hono<ApiEnv>()
chatApp.route("/", chatTargetsApp)
chatApp.route("/", eventsApp)
chatApp.route("/", roomsApp)
chatApp.route("/rooms/:roomId", conversationApp)
