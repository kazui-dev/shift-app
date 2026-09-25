import { getRouteApi, Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { useManagement } from "@/app/management-context"
import { ManagementYearSelect } from "./year-select"

const workItems = [
  {
    to: "/manage/shifts",
    name: "シフト",
  },
  {
    to: "/manage/members",
    name: "メンバー",
  },
  {
    to: "/manage/roles",
    name: "ロール",
  },
] as const
const systemItems = [
  {
    to: "/manage/years",
    name: "年度",
  },
  {
    to: "/manage/users",
    name: "ユーザー",
  },
  {
    to: "/manage/discord-link-requests",
    name: "Discord連携申請",
  },
  {
    to: "/manage/audit",
    name: "操作履歴",
  },
] as const

type Entry = (typeof workItems)[number] | (typeof systemItems)[number]
function Menu({
  entries,
  columns = false,
}: {
  entries: readonly Entry[]
  columns?: boolean
}) {
  return (
    <ul
      className={columns ? "grid gap-x-8 md:grid-cols-2" : "divide-y border-y"}
    >
      {entries.map((item) => (
        <li key={item.to} className={columns ? "border-t" : undefined}>
          <Link
            to={item.to}
            state={{ managementParent: "/manage" }}
            className="flex min-h-14 items-center gap-4 px-2 py-3 hover:bg-muted/50"
          >
            <span className="min-w-0 flex-1 text-sm font-medium">
              {item.name}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
export function ManagementHome() {
  const { state } = getRouteApi("/_app").useRouteContext()
  const { years } = useManagement()
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader className="sm:px-6">
        <h1 className="flex-1 text-base font-medium">管理</h1>
        <ManagementYearSelect />
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-10">
          {years.isPending && (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          )}
          {years.year !== null && (
            <section>
              <Menu entries={workItems} />
            </section>
          )}
          {state.member.accessLevel === "system_admin" && (
            <section>
              <h2 className="mb-3 text-sm font-medium">システム管理</h2>
              <Menu entries={systemItems} columns />
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
