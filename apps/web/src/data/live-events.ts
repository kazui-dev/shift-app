import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import * as v from "valibot"
import {
  dataEventSchema,
  type DataEvent,
  type LiveEvent,
} from "@workspace/shared/live"
import type { getChatMembers, getChatMessages } from "@/api/chat"
import { applyChatEvent } from "./chat-events"
import { keys, roomKeys } from "./keys"
import { refreshMemberships } from "./sync"

type Messages = InfiniteData<Awaited<ReturnType<typeof getChatMessages>>>
type Members = Awaited<ReturnType<typeof getChatMembers>>

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

/** Shows a new profile image on every cached post and member list at once. */
function changeProfile(
  client: QueryClient,
  memberId: string,
  image: string | null
) {
  client.setQueriesData<Messages>(
    { queryKey: keys.chatMessages() },
    (current) => {
      if (!current) return current
      const posts = current.pages.flatMap((page) => page.messages)
      // Replies name no member; one quoting a cached post of theirs is known.
      const theirs = new Set(
        posts
          .filter((post) => post.memberId === memberId)
          .map((post) => post.id)
      )
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          messages: page.messages.map((message) => ({
            ...message,
            ...(message.memberId === memberId ? { memberImage: image } : {}),
            ...(message.reply && theirs.has(message.reply.id)
              ? { reply: { ...message.reply, memberImage: image } }
              : {}),
          })),
        })),
      }
    }
  )
  client.setQueriesData<Members>(
    { queryKey: keys.chatMembers() },
    (current) =>
      current && {
        members: current.members.map((member) =>
          member.id === memberId ? { ...member, image } : member
        ),
      }
  )
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
      changeProfile(client, event.memberId, event.image)
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
