import { useState, type ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { DialogTitle } from "@workspace/ui/components/dialog"
import { RoutePage } from "@/components/route-page"
import { useManagementBack } from "@/components/manage/use-management-back"
import { useManagement } from "@/components/manage/context"
import { ManagementYearSelect } from "@/components/manage/year-select"
import { EmptyState } from "@/components/page-layout"
import { UserManager } from "@/components/system/user-manager"
import {
  AuditLogManager,
  DiscordLinkRequestManager,
} from "@/components/admin-panel"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"
import { MemberManager } from "@/components/system/member-manager"
import { YearRoleManager } from "@/components/system/year-role-manager"

const yearScreens = {
  availability: {
    title: "シフト希望フォーム",
    render: (year: number) => <AvailabilitySummary key={year} year={year} />,
  },
  members: {
    title: "メンバー",
    render: (year: number) => <MemberManager key={year} year={year} />,
  },
  roles: {
    title: "ロール",
    render: (year: number, onDirtyChange: (dirty: boolean) => void) => (
      <YearRoleManager key={year} year={year} onDirtyChange={onDirtyChange} />
    ),
  },
}
const systemScreens = {
  years: { title: "年度", render: () => <YearSettingsPanel /> },
  users: { title: "ユーザー", render: () => <UserManager /> },
  discordLinks: {
    title: "Discord連携申請",
    render: () => <DiscordLinkRequestManager />,
  },
  audit: { title: "操作履歴", render: () => <AuditLogManager /> },
}
type ManageView = keyof typeof yearScreens | keyof typeof systemScreens

export function ManagePage({ view }: { view: ManageView }) {
  const [dirty, setDirty] = useState(false)
  const {
    years: { year },
  } = useManagement()
  const close = useManagementBack(
    view === "availability" ? "/manage/shifts" : "/manage"
  )
  const yearScoped =
    view === "availability" || view === "members" || view === "roles"
  let title: string
  let content: ReactNode
  if (view === "availability" || view === "members" || view === "roles") {
    const screen = yearScreens[view]
    title = screen.title
    content =
      year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        screen.render(year, setDirty)
      )
  } else {
    title = systemScreens[view].title
    content = systemScreens[view].render()
  }
  return (
    <RoutePage
      dirty={dirty}
      dialog={view === "years" ? "compact" : "workspace"}
      onClose={close}
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageHeader className="sm:px-6">
          <button
            type="button"
            onClick={close}
            aria-label={view === "availability" ? "シフトに戻る" : "管理に戻る"}
            className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
          <DialogTitle className="flex-1 text-base font-medium">
            {title}
          </DialogTitle>
          {yearScoped && <ManagementYearSelect disabled={dirty} />}
        </PageHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{content}</div>
        </div>
      </section>
    </RoutePage>
  )
}
