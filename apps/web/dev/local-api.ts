import * as v from "valibot"
import { updateAccessLevelInputSchema } from "../../../packages/shared/src/contracts/auth"
import { roomSettingsInputSchema } from "../../../packages/shared/src/contracts/communications"
import type { Plugin } from "vite-plus"
import {
  attendanceSettingsSchema,
  type AttendanceSettings,
  tagInputSchema,
  memberTagChangesSchema,
  type YearTag,
  shiftOverviewResponseSchema,
  activityEditorInputSchema,
  activityPlansInputSchema,
  createActivityInputSchema,
  updateRoleInputSchema,
  reorderRoleInputSchema,
  reorderTagInputSchema,
} from "../../../packages/shared/src/contracts/shifts"
import { formDateInputSchema } from "../../../packages/shared/src/contracts/availability"
import {
  dates,
  makeEditors,
  refreshAssignments,
  members,
  roles,
  uuid,
} from "./fixtures"

// This server owns every /api request. Unknown requests fail closed, never proxy.
export function localApi(): Plugin {
  const editors = makeEditors()
  const attendanceByYear = new Map<number, AttendanceSettings>([
    [2026, { noticeAudience: "room_members", roleIds: [], memberIds: [] }],
  ])
  const tagsByYear = new Map<number, YearTag[]>([
    [
      2026,
      [
        {
          id: uuid(7001),
          name: "配布済み",
          memberIds: [uuid(1), uuid(2), uuid(4)],
        },
        { id: uuid(7002), name: "確認待ち", memberIds: [uuid(3), uuid(5)] },
        { id: uuid(7003), name: "機材返却済み", memberIds: [uuid(1), uuid(4)] },
      ],
    ],
    [2025, []],
  ])
  const access = new Map<string, "member" | "leader" | "system_admin">()
  let roomSettings: v.InferOutput<typeof roomSettingsInputSchema> = {
    name: "検証用チャット",
    allowExit: true,
    targets: [
      {
        targetType: "access_level",
        targetId: "system_admin",
        canRead: true,
        canPost: true,
        canManage: true,
      },
      {
        targetType: "role",
        targetId: uuid(900),
        canRead: true,
        canPost: true,
        canManage: false,
      },
    ],
  }
  const room = () => ({
    ...roomSettings,
    id: uuid(800),
    year: 2026,
    activityId: null,
    activityStartsAt: null,
    activityEndsAt: null,
    canPost: true,
    canManage: true,
    muted: false,
    lastRead: 0,
    lastSequence: 0,
    unreadCount: 0,
    createdBy: uuid(1),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  })
  let formDates = dates.map((date) => ({
    id: crypto.randomUUID(),
    date,
    startsMinute: 540,
    endsMinute: 1080,
    accepting: true,
    version: 1,
  }))
  return {
    name: "local-fixture-api",
    transformIndexHtml: (html) =>
      html.replace("<title>", "<title>画面確認用 · "),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? "/", "http://localhost").pathname
        if (!path.startsWith("/api/")) {
          next()
          return
        }
        const send = (value: unknown, status = 200) => {
          res.statusCode = status
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(value))
        }
        const fail = () =>
          send(
            {
              error: {
                code: "LOCAL_ONLY",
                message:
                  "画面確認用のローカルデータでは、この操作は利用できません。",
              },
            },
            400
          )
        const attendanceMatch = path.match(
          /^\/api\/years\/(\d+)\/attendance-settings$/
        )
        if (attendanceMatch && req.method === "GET") {
          send(
            attendanceByYear.get(Number(attendanceMatch[1])) ?? {
              noticeAudience: "selected",
              roleIds: [],
              memberIds: [],
            }
          )
          return
        }
        let body = ""
        req.setEncoding("utf8")
        req.on("data", (chunk: string) => {
          body += chunk
        })
        req.on("end", () => {
          try {
            const input: unknown = body ? JSON.parse(body) : null
            if (path === "/api/activities/plans" && req.method === "PUT") {
              const parsed = v.safeParse(activityPlansInputSchema, input)
              if (!parsed.success) {
                fail()
                return
              }
              const plans = parsed.output.plans
              if (
                plans.some(
                  ({ id, plan }) =>
                    editors.find((editor) => editor.activity.id === id)
                      ?.activity.version !== plan.version
                )
              ) {
                send(
                  {
                    error: {
                      code: "SHIFT_CHANGED",
                      message: "シフトが更新されています。",
                    },
                  },
                  409
                )
                return
              }
              for (const { id, plan } of plans) {
                const editor = editors.find((item) => item.activity.id === id)
                if (!editor) continue
                const {
                  slots,
                  responsibles,
                  candidateRoleIds,
                  requirements,
                  ...activity
                } = plan
                editor.activity = {
                  ...editor.activity,
                  ...activity,
                  version: activity.version + 1,
                }
                editor.slots = slots
                editor.responsibles = responsibles
                editor.candidateRoleIds = candidateRoleIds
                editor.requirements = requirements
              }
              refreshAssignments(editors)
              send({
                activities: editors.filter((editor) =>
                  plans.some(({ id }) => id === editor.activity.id)
                ),
              })
              return
            }
            if (attendanceMatch && req.method === "PUT") {
              const settings = v.safeParse(attendanceSettingsSchema, input)
              if (!settings.success) {
                fail()
                return
              }
              attendanceByYear.set(Number(attendanceMatch[1]), settings.output)
              res.statusCode = 204
              res.end()
              return
            }
            const tagOrderPath = /^\/api\/years\/(2025|2026)\/tag-order$/.exec(
              path
            )
            if (tagOrderPath && req.method === "PUT") {
              const parsed = v.safeParse(reorderTagInputSchema, input)
              const year = Number(tagOrderPath[1])
              const tags = tagsByYear.get(year) ?? []
              if (
                !parsed.success ||
                parsed.output.tagIds.length !== tags.length ||
                tags.some((tag) => !parsed.output.tagIds.includes(tag.id))
              )
                return fail()
              const byId = new Map(tags.map((tag) => [tag.id, tag]))
              tagsByYear.set(
                year,
                parsed.output.tagIds.flatMap((id) => {
                  const tag = byId.get(id)
                  return tag ? [tag] : []
                })
              )
              send(null, 204)
              return
            }
            const tagPath =
              /^\/api\/years\/(2025|2026)\/tags(?:\/([^/]+))?$/.exec(path)
            if (tagPath) {
              const year = Number(tagPath[1])
              const id = tagPath[2]
              const tags = tagsByYear.get(year) ?? []
              if (req.method === "GET" && !id) {
                send({ tags })
                return
              }
              const tag = tags.find((item) => item.id === id)
              if (req.method === "DELETE" && tag) {
                tagsByYear.set(
                  year,
                  tags.filter((item) => item.id !== id)
                )
                send(null, 204)
                return
              }
              const parsed = v.safeParse(tagInputSchema, input)
              if (
                !parsed.success ||
                tags.some(
                  (item) =>
                    item.name.toLowerCase() ===
                      parsed.output.name.toLowerCase() && item.id !== id
                )
              )
                return fail()
              if (req.method === "POST" && !id)
                tags.push({
                  id: crypto.randomUUID(),
                  name: parsed.output.name,
                  memberIds: [],
                })
              else if (req.method === "PUT" && tag)
                tag.name = parsed.output.name
              else return fail()
              send(null, 204)
              return
            }
            if (
              /^\/api\/years\/(2025|2026)\/member-tags$/.test(path) &&
              req.method === "PATCH"
            ) {
              const parsed = v.safeParse(memberTagChangesSchema, input)
              if (!parsed.success) return fail()
              const tags = tagsByYear.get(Number(path.split("/")[3])) ?? []
              if (
                [
                  ...parsed.output.addTagIds,
                  ...parsed.output.removeTagIds,
                ].some((id) => !tags.some((item) => item.id === id))
              )
                return fail()
              for (const tag of tags) {
                if (parsed.output.addTagIds.includes(tag.id))
                  tag.memberIds = [
                    ...new Set([...tag.memberIds, ...parsed.output.memberIds]),
                  ]
                if (parsed.output.removeTagIds.includes(tag.id))
                  tag.memberIds = tag.memberIds.filter(
                    (id) => !parsed.output.memberIds.includes(id)
                  )
              }
              send(null, 204)
              return
            }
            if (
              path.startsWith("/api/admin/users/") &&
              req.method === "PATCH"
            ) {
              const parsed = v.safeParse(updateAccessLevelInputSchema, input)
              if (!parsed.success) return fail()
              access.set(
                path.split("/").at(-1) ?? "",
                parsed.output.accessLevel
              )
              send({ ok: true })
              return
            }
            if (
              path === "/api/years/2026/memberships" &&
              req.method === "PATCH"
            ) {
              const parsed = v.safeParse(
                v.object({
                  memberIds: v.array(v.string()),
                  addRoleIds: v.array(v.string()),
                  removeRoleIds: v.array(v.string()),
                }),
                input
              )
              if (!parsed.success) return fail()
              for (const member of members) {
                if (!parsed.output.memberIds.includes(member.id)) continue
                member.roles = [
                  ...member.roles.filter(
                    (r) => !parsed.output.removeRoleIds.includes(r.id)
                  ),
                  ...roles
                    .filter(
                      (r) =>
                        parsed.output.addRoleIds.includes(r.id) &&
                        !member.roles.some((existing) => existing.id === r.id)
                    )
                    .map((r) => ({ id: r.id, name: r.name, color: r.color })),
                ]
              }
              send({ ok: true })
              return
            }
            if (path === `/api/chat/rooms/${uuid(800)}/settings`) {
              if (req.method === "PUT") {
                const parsed = v.safeParse(roomSettingsInputSchema, input)
                if (!parsed.success) return fail()
                roomSettings = parsed.output
              }
              send(roomSettings)
              return
            }
            if (path === `/api/chat/rooms/${uuid(800)}`) {
              send({ room: room() })
              return
            }
            if (path === `/api/chat/rooms/${uuid(800)}/messages`) {
              send({ messages: [], hasMore: false })
              return
            }
            if (path === `/api/chat/rooms/${uuid(800)}/members`) {
              send({ members: [] })
              return
            }
            if (path === "/api/chat/targets") {
              send({
                targets: roles.map((r) => ({
                  targetType: "role",
                  targetId: r.id,
                  displayName: r.name,
                })),
              })
              return
            }
            if (path.startsWith("/api/years/2025/")) {
              send(
                path.endsWith("/roster")
                  ? { members: [] }
                  : path.endsWith("/activities")
                    ? { activities: [] }
                    : {
                        roles: [],
                        authority: {
                          systemAdmin: true,
                          position: null,
                          permissions: [],
                        },
                      }
              )
              return
            }
            if (path === "/api/account") {
              send({
                status: "active",
                member: {
                  id: uuid(1),
                  image: null,
                  displayName: "画面確認用",
                  studentId: "26EC001",
                  accessLevel: "system_admin",
                },
                providers: { discord: false, roster: true },
                linkedProviders: ["roster"],
              })
              return
            }
            if (path === "/api/admin/users" && req.method === "GET") {
              send({
                users: members.map((member, index) => ({
                  id: member.id,
                  displayName: member.displayName,
                  studentId: member.studentId,
                  image: null,
                  years: [2026],
                  discordLinked: index % 3 !== 0,
                  accessLevel:
                    access.get(member.id) ??
                    (index === 0 ? "system_admin" : "member"),
                  isCurrentUser: index === 0,
                  sessionCount: 1,
                  createdAt: 1780000000000,
                })),
              })
              return
            }
            if (
              path === "/api/admin/identity-link-requests" &&
              req.method === "GET"
            ) {
              send({ requests: [] })
              return
            }
            if (path === "/api/admin/audit-logs" && req.method === "GET") {
              send({ auditLogs: [] })
              return
            }
            if (path === "/api/years") {
              send({
                years: [
                  { year: 2026, isDefault: true, canManage: true },
                  { year: 2025, isDefault: false, canManage: true },
                ],
              })
              return
            }
            if (path === "/api/me/display-year") {
              send({
                year: 2026,
                defaultYear: 2026,
                unavailableSelection: false,
                years: [2026],
              })
              return
            }
            if (path === "/api/me/notification-devices") {
              send({ devices: [] })
              return
            }
            if (path === "/api/me/assignments") {
              send({ assignments: [] })
              return
            }
            if (path === "/api/chat/rooms") {
              send({ rooms: [room()] })
              return
            }
            if (path === "/api/years/2026/roster") {
              send({ members })
              return
            }
            if (path === "/api/years/2026/role-order" && req.method === "PUT") {
              const parsed = v.safeParse(reorderRoleInputSchema, input)
              if (
                !parsed.success ||
                parsed.output.roleIds.length !== roles.length ||
                new Set(parsed.output.roleIds).size !== roles.length ||
                roles.some((r) => !parsed.output.roleIds.includes(r.id))
              ) {
                fail()
                return
              }
              const ids = parsed.output.roleIds
              roles.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
              roles.forEach((role, index) => {
                role.position = roles.length - index
              })
              send(null, 204)
              return
            }
            if (path === "/api/years/2026/roles") {
              send({
                authority: {
                  systemAdmin: true,
                  position: null,
                  permissions: [
                    "shift.create",
                    "shift.manage",
                    "member.manage",
                    "role.manage",
                  ],
                },
                roles,
              })
              return
            }
            if (path.startsWith("/api/roles/") && req.method === "PUT") {
              const parsed = v.safeParse(updateRoleInputSchema, input)
              const role = roles.find((r) => r.id === path.split("/").at(-1))
              if (!parsed.success || !role) {
                fail()
                return
              }
              role.name = parsed.output.name
              role.color = parsed.output.color
              role.permissions = parsed.output.permissions
              send(null, 204)
              return
            }
            if (path === "/api/years/2026/availability-dates") {
              send({ dates: formDates })
              return
            }
            if (path.startsWith("/api/years/2026/availability-dates/")) {
              const date = path.split("/").at(-1)
              if (req.method === "DELETE") {
                formDates = formDates.filter((d) => d.date !== date)
                send(null, 204)
                return
              }
              const parsed = v.safeParse(formDateInputSchema, input)
              if (!parsed.success) {
                fail()
                return
              }
              const old = formDates.find((d) => d.date === parsed.output.date)
              formDates = [
                ...formDates.filter((d) => d.date !== parsed.output.date),
                {
                  ...parsed.output,
                  id: old?.id ?? crypto.randomUUID(),
                  version: (old?.version ?? 0) + 1,
                },
              ]
              send(null, 204)
              return
            }
            if (path === "/api/me/availability/2026") {
              send({
                dates: formDates,
                answers: [],
                submitted: [],
                submittedAt: null,
                revision: 0,
                draftRevision: null,
              })
              return
            }
            if (path === "/api/years/2026/availability-submissions") {
              send({
                progress: members.map((m, i) => ({
                  memberId: m.id,
                  displayName: m.displayName,
                  studentId: m.studentId,
                  image: null,
                  complete: i % 13 !== 7,
                  hasHistory: false,
                })),
                submissions: [],
              })
              return
            }
            if (path === "/api/years/2026/shift-overview") {
              const date = new URL(
                req.url ?? "/",
                "http://localhost"
              ).searchParams.get("date")
              const selected = editors.filter(
                (entry) => entry.activity.startsAt.slice(0, 10) === date
              )
              const first = selected[0]
              send(
                v.parse(shiftOverviewResponseSchema, {
                  canEdit: true,
                  members,
                  roles: first?.roles ?? [],
                  availability:
                    first?.availability.filter(
                      (window) => window.startsAt.slice(0, 10) === date
                    ) ?? [],
                  availabilityAnswers:
                    first?.availabilityAnswers.filter(
                      (answer) => answer.date === date
                    ) ?? [],
                  activities: selected.map((entry) => entry.activity),
                  assignments: selected.flatMap((entry) =>
                    entry.slots.flatMap((slot) =>
                      slot.memberIds.map((memberId) => ({
                        id: `${slot.id}-${memberId}`,
                        slotId: slot.id,
                        activityId: entry.activity.id,
                        memberId,
                        startsAt: slot.startsAt,
                        endsAt: slot.endsAt,
                        attendance: null,
                      }))
                    )
                  ),
                })
              )
              return
            }
            if (path === "/api/years/2026/activities") {
              if (req.method === "POST") {
                const parsed = v.safeParse(createActivityInputSchema, input)
                const template = editors[0]
                if (!parsed.success || !template) {
                  fail()
                  return
                }
                const editor = {
                  ...template,
                  activity: {
                    ...parsed.output,
                    id: crypto.randomUUID(),
                    year: 2026,
                    active: true,
                    version: 1,
                  },
                  slots: [],
                  responsibles: parsed.output.responsibles,
                  candidateRoleIds: parsed.output.candidateRoleIds,
                }
                editors.push(editor)
                send({ activity: editor.activity }, 201)
                return
              }
              send({
                activities: editors.map((e) => ({
                  ...e.activity,
                  requirements: e.requirements,
                  responsibleNames: e.responsibles.flatMap((target) => {
                    const name =
                      target.targetType === "role"
                        ? roles.find((role) => role.id === target.targetId)
                            ?.name
                        : members.find(
                            (member) => member.id === target.targetId
                          )?.displayName
                    return name ? [name] : []
                  }),
                  assignmentCount: e.slots.reduce(
                    (count, slot) => count + slot.memberIds.length,
                    0
                  ),
                })),
              })
              return
            }
            const editor = editors.find(
              (e) => e.activity.id === path.split("/")[3]
            )
            if (editor && path.endsWith("/copies") && req.method === "POST") {
              const parsed = v.safeParse(
                v.object({
                  date: v.string(),
                  startsAt: v.pipe(v.string(), v.isoTimestamp()),
                  endsAt: v.pipe(v.string(), v.isoTimestamp()),
                }),
                input
              )
              if (!parsed.success) return fail()
              const start = Date.parse(parsed.output.startsAt),
                end = Date.parse(parsed.output.endsAt)
              const delta = start - Date.parse(editor.activity.startsAt)
              const copy = structuredClone(editor)
              copy.activity = {
                ...copy.activity,
                id: crypto.randomUUID(),
                version: 1,
                startsAt: parsed.output.startsAt,
                endsAt: parsed.output.endsAt,
              }
              copy.slots = copy.slots
                .filter(
                  (s) =>
                    Date.parse(s.startsAt) + delta < end &&
                    Date.parse(s.endsAt) + delta > start
                )
                .map((s) => ({
                  ...s,
                  id: crypto.randomUUID(),
                  startsAt: new Date(
                    Math.max(start, Date.parse(s.startsAt) + delta)
                  ).toISOString(),
                  endsAt: new Date(
                    Math.min(end, Date.parse(s.endsAt) + delta)
                  ).toISOString(),
                  memberIds: [],
                }))
              copy.requirements = copy.requirements
                .filter(
                  (s) =>
                    Date.parse(s.startsAt) + delta < end &&
                    Date.parse(s.endsAt) + delta > start
                )
                .map((s) => ({
                  ...s,
                  id: crypto.randomUUID(),
                  startsAt: new Date(
                    Math.max(start, Date.parse(s.startsAt) + delta)
                  ).toISOString(),
                  endsAt: new Date(
                    Math.min(end, Date.parse(s.endsAt) + delta)
                  ).toISOString(),
                }))
              editors.push(copy)
              send({ id: copy.activity.id }, 201)
              return
            }
            if (editor && /^\/api\/activities\/[^/]+$/.test(path)) {
              if (req.method === "DELETE") {
                editors.splice(editors.indexOf(editor), 1)
                send(null, 204)
                return
              }
              if (req.method === "PUT") {
                const parsed = v.safeParse(activityEditorInputSchema, input)
                if (!parsed.success) {
                  fail()
                  return
                }
                if (parsed.output.version !== editor.activity.version) {
                  send(
                    {
                      error: {
                        code: "SHIFT_CHANGED",
                        message: "シフトが更新されています。",
                      },
                    },
                    409
                  )
                  return
                }
                const {
                  slots,
                  responsibles,
                  candidateRoleIds,
                  requirements,
                  ...activity
                } = parsed.output
                editor.activity = {
                  ...editor.activity,
                  ...activity,
                  version: activity.version + 1,
                }
                editor.slots = slots
                editor.responsibles = responsibles
                editor.candidateRoleIds = candidateRoleIds
                editor.requirements =
                  input !== null &&
                  typeof input === "object" &&
                  !Object.hasOwn(input, "requirements")
                    ? editor.requirements
                    : requirements
              }
              if (req.method !== "GET" && req.method !== "PUT") {
                fail()
                return
              }
              refreshAssignments(editors)
              send(editor)
              return
            }
            if (editor && path.endsWith("/attendance")) {
              send({
                canManage: true,
                assignments: [],
                timelineAssignments: editors.flatMap((source) =>
                  source.slots.flatMap((slot) =>
                    slot.memberIds.map((memberId) => ({
                      id: `${slot.id}:${memberId}`,
                      slotId: slot.id,
                      activityId: source.activity.id,
                      memberId,
                      startsAt: slot.startsAt,
                      endsAt: slot.endsAt,
                      attendance: {
                        state: ["late", "absent", "present"][
                          Number(memberId.slice(-3)) % 3
                        ],
                        checkInStatus: "confirmed",
                        checkedInAt: null,
                        expectedAt: null,
                        resolvedAt: null,
                      },
                    }))
                  )
                ),
              })
              return
            }
            fail()
          } catch {
            fail()
          }
        })
      })
    },
  }
}
