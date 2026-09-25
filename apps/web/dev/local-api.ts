import * as v from "valibot"
import type { Plugin } from "vite-plus"
import {
  activityEditorInputSchema,
  createActivityInputSchema,
  updateRoleInputSchema,
} from "../../../packages/shared/src/shifts"
import { formDateInputSchema } from "../../../packages/shared/src/availability"
import { dates, makeEditors, members, roles, uuid } from "./fixtures"

// This server owns every /api request. Unknown requests fail closed, never proxy.
export function localApi(): Plugin {
  const editors = makeEditors()
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
        let body = ""
        req.setEncoding("utf8")
        req.on("data", (chunk: string) => {
          body += chunk
        })
        req.on("end", () => {
          try {
            const input: unknown = body ? JSON.parse(body) : null
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
                  accessLevel: index === 0 ? "system_admin" : "member",
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
                years: [{ year: 2026, isDefault: true, canManage: true }],
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
              send({ rooms: [] })
              return
            }
            if (path === "/api/years/2026/roster") {
              send({ members })
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
                })),
                submissions: [],
              })
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
            if (editor && /^\/api\/activities\/[^/]+$/.test(path)) {
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
                const { slots, responsibles, candidateRoleIds, ...activity } =
                  parsed.output
                editor.activity = {
                  ...editor.activity,
                  ...activity,
                  version: activity.version + 1,
                }
                editor.slots = slots
                editor.responsibles = responsibles
                editor.candidateRoleIds = candidateRoleIds
              }
              if (req.method !== "GET" && req.method !== "PUT") {
                fail()
                return
              }
              send(editor)
              return
            }
            if (editor && path.endsWith("/attendance")) {
              send({ canManage: true, assignments: [] })
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
