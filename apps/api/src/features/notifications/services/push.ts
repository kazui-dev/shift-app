import type { RoomDevice } from "../domain/room-device"
import { japanMonthDayTime } from "@workspace/shared/japan-time"
import webpush from "web-push"
import { clearPushTransport } from "./notification-devices"

import { dueReminderWindow } from "../domain/reminder-window"

type SubscriptionRow = {
  id: string
  endpoint: string
  expirationTime: number | null
  p256dh: string
  auth: string
}

type AssignmentNotification = {
  assignmentId: string
  memberId: string
  activityName: string
  place: string
  startsAt: number
}

async function deliver(
  env: CloudflareBindings,
  subscription: SubscriptionRow,
  payload: string
): Promise<"sent" | "dead" | "retry"> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      {
        TTL: 60 * 60,
        // Shifts and messages are read while they still matter, so the push
        // service must wake the device rather than hold the message for its
        // next batch.
        urgency: "high",
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
      }
    )
    return "sent"
  } catch (error) {
    const statusCode =
      error instanceof webpush.WebPushError ? error.statusCode : 0
    if (statusCode === 404 || statusCode === 410) return "dead"
    console.warn(
      JSON.stringify({
        message: "Push delivery failed",
        statusCode,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    )
    return "retry"
  }
}

async function claimAndSend(
  env: CloudflareBindings,
  assignment: AssignmentNotification,
  subscription: SubscriptionRow
) {
  const kind = "ten_minute"
  const claimedAt = Date.now()
  const claim = await env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO notification_deliveries
        (assignment_id, subscription_id, kind, status, claimed_at, sent_at)
       VALUES (?, ?, ?, 'claimed', ?, NULL)`
    )
    .bind(assignment.assignmentId, subscription.id, kind, claimedAt)
    .run()
  if (claim.meta.changes !== 1) return

  const title = "シフト開始10分前"
  const result = await deliver(
    env,
    subscription,
    JSON.stringify({
      title,
      body: `${japanMonthDayTime(assignment.startsAt)} ${assignment.activityName}・${assignment.place}`,
      tag: `${kind}-${assignment.assignmentId}`,
      data: { url: "/calendar" },
    })
  )
  if (result === "sent") {
    await env.shift_app
      .prepare(
        `UPDATE notification_deliveries
         SET status = 'sent', sent_at = ?
         WHERE assignment_id = ? AND subscription_id = ? AND kind = ?`
      )
      .bind(Date.now(), assignment.assignmentId, subscription.id, kind)
      .run()
  } else {
    if (result === "dead")
      await clearPushTransport(
        env.shift_app,
        subscription.id,
        subscription.endpoint
      )
    await env.shift_app
      .prepare(
        `DELETE FROM notification_deliveries
         WHERE assignment_id = ? AND subscription_id = ? AND kind = ?
           AND status = 'claimed'`
      )
      .bind(assignment.assignmentId, subscription.id, kind)
      .run()
  }
}

async function subscriptionsForMember(
  env: CloudflareBindings,
  memberId: string
): Promise<SubscriptionRow[]> {
  const result = await env.shift_app
    .prepare(
      `SELECT id, endpoint, expiration_time AS expirationTime, p256dh, auth
       FROM notification_devices WHERE member_id = ? AND enabled=1 AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL`
    )
    .bind(memberId)
    .all<SubscriptionRow>()
  return result.results
}

export async function sendMemberNotification(
  env: CloudflareBindings,
  memberId: string,
  title: string,
  body: string,
  url: string,
  tag: string
) {
  const subscriptions = await subscriptionsForMember(env, memberId)
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await deliver(
        env,
        subscription,
        JSON.stringify({ title, body, tag, data: { url } })
      )
      if (result === "dead")
        await clearPushTransport(
          env.shift_app,
          subscription.id,
          subscription.endpoint
        )
      return result !== "retry"
    })
  )
  return results.every(Boolean)
}

/** Notifies a room's devices, except the sender's own, about a new message. */
export async function notifyRoomMessage(
  env: CloudflareBindings,
  devices: RoomDevice[],
  roomId: string,
  senderId: string,
  name: string,
  content: string
) {
  const subscriptions = devices.filter((device) => device.memberId !== senderId)
  const payload = JSON.stringify({
    title: name,
    body: content,
    tag: `chat-${roomId}`,
    data: { url: `/chat/${roomId}` },
  })
  const started = Date.now()
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await deliver(env, subscription, payload)
      if (result === "dead")
        await clearPushTransport(
          env.shift_app,
          subscription.id,
          subscription.endpoint
        )
      return result
    })
  )
  // One line a message: how many devices it went to, how the push services
  // answered, and how long they took, to tell a slow or lost push from ours.
  console.info(
    JSON.stringify({
      message: "Room push sent",
      roomId,
      devices: results.length,
      sent: results.filter((result) => result === "sent").length,
      dead: results.filter((result) => result === "dead").length,
      retry: results.filter((result) => result === "retry").length,
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
    })
  )
}

export async function sendDueAssignmentReminders(
  env: CloudflareBindings,
  scheduledTime: number
) {
  const { from, to } = dueReminderWindow(scheduledTime)
  const rows = await env.shift_app
    .prepare(
      `SELECT assignment.id AS assignmentId, assignment.member_id AS memberId,
              activity.name AS activityName, activity.place,
              slot.starts_at AS startsAt,
              subscription.id, subscription.endpoint,
              subscription.expiration_time AS expirationTime,
              subscription.p256dh, subscription.auth
       FROM shift_assignments assignment
       JOIN shift_slots slot ON slot.id = assignment.slot_id
       JOIN activities activity ON activity.id = slot.activity_id
       JOIN year_memberships year_membership
         ON year_membership.year = activity.year
        AND year_membership.member_id = assignment.member_id
        AND year_membership.status = 'active'
       JOIN notification_devices subscription
         ON subscription.member_id = assignment.member_id
         AND subscription.enabled=1 AND subscription.endpoint IS NOT NULL
         AND subscription.p256dh IS NOT NULL AND subscription.auth IS NOT NULL
       WHERE assignment.status = 'active' AND activity.active = 1
         AND slot.starts_at > ? AND slot.starts_at <= ?`
    )
    .bind(from, to)
    .all<AssignmentNotification & SubscriptionRow>()

  await Promise.all(rows.results.map((row) => claimAndSend(env, row, row)))
}
