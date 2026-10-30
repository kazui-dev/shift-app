import { useLayoutEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { japanDateTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { AttendanceSheet } from "../src/features/calendar/components/attendance-sheet"
import { CalendarDayTimeline } from "../src/features/calendar/components/calendar-day-timeline"
import { calendarHourHeight } from "../src/features/calendar/components/calendar-layout"
import type { ShiftCoworker } from "@workspace/shared/shifts"
import type { CalendarAssignment } from "../src/features/shifts/api/assignments"
import "../src/styles.css"

const at = (time: string) => `2026-11-01T${time}:00+09:00`
const now = Date.parse(at("10:30"))
const assignment: CalendarAssignment = {
  id: "preview-assignment",
  activityId: "preview-reception",
  roomId: null,
  memberId: "preview-self",
  memberDisplayName: "自分",
  activityName: "総合受付",
  place: "1号館 正面入口",
  activityType: "シフト",
  color: "#64748b",
  startsAt: at("09:00"),
  endsAt: at("13:00"),
  notes: null,
  attendance: null,
  notices: [],
}
const examples: {
  name: string
  studentId: string
  start: string
  end: string
  attendance: ShiftCoworker["attendance"]
}[] = [
  {
    name: "田中 葵",
    studentId: "24EC012",
    start: "09:00",
    end: "12:00",
    attendance: {
      state: "present",
      checkInStatus: "confirmed",
      expectedAt: null,
    },
  },
  {
    name: "佐藤 蓮",
    studentId: "25EC038",
    start: "10:00",
    end: "13:00",
    attendance: { state: "late", checkInStatus: null, expectedAt: at("10:45") },
  },
  {
    name: "高橋 美咲",
    studentId: "24FI056",
    start: "10:00",
    end: "12:00",
    attendance: { state: "absent", checkInStatus: null, expectedAt: null },
  },
  {
    name: "鈴木 悠真",
    studentId: "26EC021",
    start: "10:00",
    end: "12:00",
    attendance: null,
  },
  {
    name: "小林 凛",
    studentId: "25FI083",
    start: "10:00",
    end: "12:30",
    attendance: {
      state: "present",
      checkInStatus: "pending",
      expectedAt: null,
    },
  },
  {
    name: "山本 結衣",
    studentId: "25EC064",
    start: "11:00",
    end: "14:00",
    attendance: null,
  },
  {
    name: "中村 湊",
    studentId: "26FI047",
    start: "12:00",
    end: "15:00",
    attendance: null,
  },
  {
    name: "渡辺 陽菜",
    studentId: "24EC095",
    start: "08:00",
    end: "10:00",
    attendance: {
      state: "present",
      checkInStatus: "confirmed",
      expectedAt: null,
    },
  },
]
const members: ShiftCoworker[] = examples.map((member, index) => ({
  ...member,
  id: `preview-${index}`,
  activityId: assignment.activityId,
  memberId: `preview-member-${index}`,
  startsAt: at(member.start),
  endsAt: at(member.end),
}))
const familyNames = [
  "佐々木",
  "山口",
  "松本",
  "井上",
  "木村",
  "林",
  "清水",
  "山崎",
]
const givenNames = ["葵", "蓮", "陽菜", "悠真", "結衣", "湊", "美咲", "大和"]
function crowdedMembers(ended: boolean): ShiftCoworker[] {
  return Array.from({ length: 36 }, (_, index) => ({
    id: `crowded-${index}`,
    activityId: assignment.activityId,
    memberId: `crowded-member-${index}`,
    name: `${familyNames[index % 8]} ${givenNames[Math.floor(index / 8)]}`,
    studentId: `26EC${String(101 + index).padStart(3, "0")}`,
    startsAt: at(ended ? "08:30" : "09:30"),
    endsAt: at(ended ? "10:00" : "12:30"),
    attendance:
      index % 5 === 0
        ? null
        : {
            state: "present",
            checkInStatus: "confirmed",
            expectedAt: null,
          },
  }))
}

export function Preview() {
  const [open, setOpen] = useState(true)
  const [mounted, setMounted] = useState(true)
  const scroll = useRef<HTMLDivElement>(null)
  const mode = new URLSearchParams(location.search).get("case")
  const visible =
    mode === "empty"
      ? []
      : mode === "long"
        ? [
            ...members,
            ...members.map((member, index) => ({
              ...member,
              id: `long-${index}`,
              memberId: `long-member-${index}`,
              name: index === 0 ? "勅使河原 アレクサンダー" : member.name,
            })),
          ]
        : mode === "current-long" || mode === "ended-long"
          ? [...members, ...crowdedMembers(mode === "ended-long")]
          : members
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 8 * calendarHourHeight
  }, [])
  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-8">
        <span className="font-semibold">11月</span>
        <span className="text-xs text-muted-foreground">
          UI確認 · 架空データ
        </span>
        <Button
          variant="outline"
          onClick={() => {
            setMounted(true)
            setOpen(true)
          }}
        >
          勤務を開く
        </Button>
      </header>
      <p className="py-4 text-center text-sm font-semibold">
        2026年11月1日（日）
      </p>
      <div ref={scroll} className="min-h-0 flex-1 overflow-auto px-4 sm:px-8">
        <CalendarDayTimeline
          date="2026-11-01"
          now={japanDateTime(new Date(now))}
          assignments={[assignment]}
          onAttendance={() => {
            setMounted(true)
            setOpen(true)
          }}
        />
      </div>
      <AttendanceSheet
        open={open}
        assignment={mounted ? assignment : null}
        members={visible}
        now={now}
        offline={false}
        checkingIn={false}
        onCheckIn={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClosed={() => setMounted(false)}
      />
    </main>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Preview root is missing")
createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <Preview />
  </QueryClientProvider>
)
