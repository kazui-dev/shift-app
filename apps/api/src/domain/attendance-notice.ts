import { japanMonthDay, japanTime } from "@workspace/shared/japan-time"

/** What a member reported about a shift of theirs. */
export type AttendanceReport =
  | { state: "late"; expectedAt: number | null; reason: string }
  | { state: "absent"; reason: string }
  | { state: "withdrawn"; previous: "late" | "absent" }

/** A report, with the shift and the member it belongs to. */
export type AttendanceNotice = AttendanceReport & {
  displayName: string
  startsAt: number
  endsAt: number
}

const heading = { late: "遅刻", absent: "欠勤", withdrawn: "取り消し" }

/** The report's own items, such as the expected arrival and the reason. */
function details(notice: AttendanceNotice) {
  if (notice.state === "withdrawn")
    return [`取り消した連絡: ${heading[notice.previous]}`]
  const items =
    notice.state === "late"
      ? [
          `到着見込み: ${notice.expectedAt === null ? "未定" : japanTime(notice.expectedAt)}`,
        ]
      : []
  return notice.reason ? [...items, `理由: ${notice.reason}`] : items
}

/**
 * The attendance bot's words. The message puts the heading and name, the
 * shift, then each item on a line of its own; the push notification says
 * the same on one line.
 */
export function attendanceNotice(notice: AttendanceNotice) {
  const title = `【${heading[notice.state]}】 ${notice.displayName}`
  const shift = `${japanMonthDay(notice.startsAt)} ${japanTime(notice.startsAt)}〜${japanTime(notice.endsAt)}`
  return {
    content: [title, `シフト: ${shift}`, ...details(notice)].join("\n"),
    notification: [title, `(${shift})`, ...details(notice)].join(" "),
  }
}
