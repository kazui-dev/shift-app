import type { InferOutput } from "valibot"
import type {
  activityEditorResponseSchema,
  yearRoleResponseSchema,
} from "@workspace/shared/shifts"

export type Editor = InferOutput<typeof activityEditorResponseSchema>
export const uuid = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
export const dates = ["2026-11-01", "2026-11-02", "2026-11-03"]
const at = (date: string, hour: number) =>
  new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+09:00`).toISOString()
export const roles: InferOutput<typeof yearRoleResponseSchema>[] = [
  "受付班",
  "企画班",
  "運営班",
].map((name, index) => ({
  id: uuid(900 + index),
  year: 2026,
  position: 3 - index,
  name,
  color: "#64748B",
  permissions: [],
  memberCount: 107,
}))
const family = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
  "伊藤",
  "渡辺",
  "山本",
  "中村",
  "小林",
  "加藤",
  "吉田",
  "山田",
  "佐々木",
  "山口",
  "松本",
  "井上",
]
const given = [
  "葵",
  "蓮",
  "陽菜",
  "悠真",
  "結衣",
  "湊",
  "美咲",
  "大和",
  "凛",
  "樹",
  "杏",
  "颯太",
  "楓",
  "蒼",
  "琴音",
  "陸",
  "紬",
  "陽翔",
  "澪",
  "律",
]
export const members: Editor["members"] = Array.from(
  { length: 320 },
  (_, i) => ({
    id: uuid(i + 1),
    image: null,
    displayName: `${family[i % 16]} ${given[(i * 7 + Math.floor(i / 16)) % 20]}`,
    studentId: `26EC${String(i + 1).padStart(3, "0")}`,
    roles: roles.filter((_role, n) => n === i % 3),
  })
)
export function makeEditors(): Editor[] {
  return dates.flatMap((date, day) =>
    ["総合受付", "会場案内", "設営・片付け"].map((name, job) => ({
      activity: {
        id: uuid(1000 + day * 3 + job),
        year: 2026,
        active: true,
        version: 1,
        name,
        place: job === 0 ? "1号館 正面入口" : "中庭",
        activityType: "シフト",
        startsAt: at(date, 9),
        endsAt: at(date, 18),
        color: "#64748B",
        notes: "",
      },
      candidateRoleIds: [],
      responsibles: [
        { targetType: "role" as const, targetId: uuid(900 + job) },
      ],
      members,
      roles,
      slots: Array.from({ length: 6 }, (_, n) => ({
        id: uuid(10000 + day * 100 + job * 10 + n),
        startsAt: at(date, 9 + n),
        endsAt: at(date, 11 + n),
        capacity: null,
        memberIds: members
          .filter((_member, i) => i % 11 === n && i % 3 === job)
          .map((m) => m.id),
      })),
      availability: members.flatMap((m, i) =>
        dates.flatMap((d, di) =>
          (i + di) % 13 === 7 || (i + di) % 17 === 8
            ? []
            : [
                {
                  memberId: m.id,
                  startsAt: at(d, 9 + ((i + di) % 3)),
                  endsAt: at(d, 15 + ((i + di) % 4)),
                },
              ]
        )
      ),
      submittedMemberIds: members
        .filter((_, i) => i % 13 !== 7)
        .map((m) => m.id),
      otherAssignments: members
        .filter((_, i) => i % 7 === 0)
        .map((m) => ({
          memberId: m.id,
          startsAt: at(date, 16),
          endsAt: at(date, 18),
          name: "片付け",
        })),
    }))
  )
}
