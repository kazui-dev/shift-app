import webpush from "web-push"
import { clearPushTransport } from "./push-devices"

import { dueReminderWindow } from "../domain/reminder-window"

type SubscriptionRow = {
  id: string
  endpoint: string
  expirationTime: number | null
  p256dh: string
  auth: string
}

type NotificationKind = "assigned" | "ten_minute"

type AssignmentNotification = {
  assignmentId: string
  memberId: string
  activityName: string
  place: string
  startsAt: number
}

function startTime(value: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

async function deliver(
  env: CloudflareBindings,
  subscription: SubscriptionRow,
  payload: string
): Promise<"sent" | "dead" | "retry"> {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  )
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      { TTL: 60 * 60 }
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
  subscription: SubscriptionRow,
  kind: NotificationKind
) {
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

  const title =
    kind === "assigned" ? "シフトが更新されました" : "シフト開始10分前"
  const result = await deliver(
    env,
    subscription,
    JSON.stringify({
      title,
      body: `${startTime(assignment.startsAt)} ${assignment.activityName}・${assignment.place}`,
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
       FROM push_devices WHERE member_id = ? AND enabled=1 AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL`
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

export async function notifyRoomMessage(
  env: CloudflareBindings,
  roomId: string,
  senderId: string,
  name: string,
  content: string
) {
  const recipients = await env.shift_app
    .prepare(
      `SELECT e.member_id AS memberId FROM chat_effective_permissions e JOIN chat_rooms r ON r.id=e.room_id LEFT JOIN chat_room_preferences p ON p.room_id=e.room_id AND p.member_id=e.member_id WHERE e.room_id=? AND e.can_read=1 AND e.member_id<>? AND COALESCE(p.muted,0)=0 AND r.status='active'`
    )
    .bind(roomId, senderId)
    .all<{ memberId: string }>()
  await Promise.all(
    recipients.results.map((item) =>
      sendMemberNotification(
        env,
        item.memberId,
        name,
        content,
        `/chat/${roomId}`,
        `chat-${roomId}`
      )
    )
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
       JOIN push_devices subscription
         ON subscription.member_id = assignment.member_id
         AND subscription.enabled=1 AND subscription.endpoint IS NOT NULL
         AND subscription.p256dh IS NOT NULL AND subscription.auth IS NOT NULL
       WHERE assignment.status = 'active' AND activity.active = 1
         AND slot.starts_at > ? AND slot.starts_at <= ?`
    )
    .bind(from, to)
    .all<AssignmentNotification & SubscriptionRow>()

  await Promise.all(
    rows.results.map((row) => claimAndSend(env, row, row, "ten_minute"))
  )
}
