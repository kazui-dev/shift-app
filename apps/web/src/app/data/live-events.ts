import type { QueryClient } from "@tanstack/react-query"
import * as v from "valibot"
import {
  dataEventSchema,
  type DataEvent,
  type LiveEvent,
} from "@workspace/shared/live"
import {
  applyChatEvent,
  changeChatProfile,
} from "@/features/chat/data/chat-events"
import { keys, roomKeys } from "./keys"
import { refreshMemberships } from "./sync"

/** What a missed event could have changed outside chat. */
const reconnectKeys = [
  keys.activities,
  keys.assignments,
  keys.shiftAttendance,
  keys.attendanceEvents,
  keys.availability,
  keys.availabilityDates,
  keys.availabilitySubmissions,
]

function invalidate(client: QueryClient, cacheKeys: unknown[][]) {
  for (const queryKey of cacheKeys) void client.invalidateQueries({ queryKey })
}

function applyDataEvent(client: QueryClient, event: DataEvent) {
  switch (event.type) {
    case "access_changed":
      void refreshMemberships(client)
      return
    case "shifts_changed":
      // Shift rooms follow assignments, so chat access may have moved too.
      invalidate(client, [
        keys.activities(),
        keys.assignments(),
        keys.shiftAttendance(),
        keys.chatRooms(),
        ...roomKeys.map((key) => key()),
      ])
      return
    case "attendance_changed":
      invalidate(client, [
        keys.shiftAttendance(event.activityId),
        keys.attendanceEvents(),
      ])
      return
    case "availability_changed":
      invalidate(client, [
        keys.availability(event.year),
        keys.availabilityDates(event.year),
        keys.availabilitySubmissions(event.year),
      ])
      return
    case "availability_submitted":
      invalidate(client, [keys.availabilitySubmissions(event.year)])
      return
    case "profile_changed":
      changeChatProfile(client, event.memberId, event.image)
  }
}

/**
 * Brings the cache up to date with a live event. `null` means the connection
 * (re)opened, when anything may have been missed.
 */
export function applyLiveEvent(
  client: QueryClient,
  event: LiveEvent | null,
  memberId: string
) {
  if (!event) {
    applyChatEvent(client, null, memberId)
    invalidate(
      client,
      reconnectKeys.map((key) => key())
    )
    return
  }
  if (v.is(dataEventSchema, event)) applyDataEvent(client, event)
  else applyChatEvent(client, event, memberId)
}
