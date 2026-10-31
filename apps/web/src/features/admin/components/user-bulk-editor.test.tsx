// @vitest-environment jsdom
import { act, type ReactNode, type ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import type { AdminUser } from "@workspace/shared/auth"
import { UserBulkEditor } from "./user-bulk-editor"
import {
  activateYearMembership,
  deactivateYearMembership,
  updateAdminAccessLevel,
} from "../api/admin"
vi.mock("../api/admin", () => ({
  activateYearMembership: vi.fn<typeof activateYearMembership>(),
  deactivateYearMembership: vi.fn<typeof deactivateYearMembership>(),
  updateAdminAccessLevel: vi.fn<typeof updateAdminAccessLevel>(),
}))
vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))
vi.mock("@/components/select-field", () => ({
  SelectField: ({
    value,
    options,
    onValueChange,
    disabled,
    ...props
  }: {
    value: string
    options: { value: string; label: string }[]
    onValueChange: (value: string) => void
    disabled: boolean
  } & Omit<ComponentProps<"select">, "onChange" | "value">) => (
    <select
      {...props}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))
const users: AdminUser[] = ["a", "b", "self"].map((id, index) => ({
  id,
  displayName: id,
  studentId: `26EC00${index}`,
  image: null,
  years: index === 0 ? [2026] : [],
  accessLevel: "member",
  discordLinked: false,
  isCurrentUser: id === "self",
  sessionCount: 0,
  createdAt: 0,
}))
async function fixture(kind: "years" | "access") {
  vi.clearAllMocks()
  vi.mocked(activateYearMembership).mockResolvedValue({
    membership: {
      year: 2026,
      member: { id: "b", displayName: "b", studentId: "26EC001", image: null },
      status: "active",
      updatedAt: new Date(0).toISOString(),
    },
  })
  vi.mocked(deactivateYearMembership).mockResolvedValue(undefined)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host),
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined)
  const applied = vi.fn<() => void>(),
    closed = vi.fn<() => void>(),
    dirty = vi.fn<(dirty: boolean) => void>()
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <UserBulkEditor
          kind={kind}
          users={users}
          years={[2026, 2025]}
          onApplied={applied}
          onClose={closed}
          onDirtyChange={dirty}
        />
      </QueryClientProvider>
    )
  )
  const button = (text: string) => {
    const result = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === text
    )
    if (!result) throw new Error(text)
    return result
  }
  const select = async (label: string, value: string) => {
    const input = host.querySelector<HTMLSelectElement>(
      `select[aria-label="${label}"]`
    )
    if (!input) throw new Error(label)
    await act(async () => {
      input.value = value
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
  }
  const input = async (value: string) => {
    const element = host.querySelector<HTMLInputElement>(
      'input[aria-label="変更理由"]'
    )
    if (!element) throw new Error("reason")
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
  return {
    host,
    button,
    select,
    input,
    applied,
    closed,
    dirty,
    cleanup: async () => {
      await act(async () => root.unmount())
      client.clear()
      host.remove()
      vi.unstubAllGlobals()
    },
  }
}
it("applies only year differences and retries failed operations without repeating successful changes", async () => {
  const f = await fixture("years")
  try {
    vi.mocked(activateYearMembership).mockRejectedValueOnce(
      new Error("参加できません")
    )
    expect(f.button("適用").disabled).toBe(true)
    await f.select("2026年度の変更", "add")
    expect(activateYearMembership).not.toHaveBeenCalled()
    await act(async () => f.button("適用").click())
    expect(activateYearMembership).toHaveBeenCalledTimes(2)
    expect(activateYearMembership).not.toHaveBeenCalledWith(2026, "a")
    expect(f.applied).not.toHaveBeenCalled()
    expect(f.host.querySelector('[role="alert"]')?.textContent).toContain(
      "b・2026年度"
    )
    await act(async () => f.button("再試行").click())
    expect(activateYearMembership).toHaveBeenCalledTimes(3)
    expect(activateYearMembership).toHaveBeenLastCalledWith(2026, "b")
    expect(f.applied).toHaveBeenCalledOnce()
    expect(deactivateYearMembership).not.toHaveBeenCalled()
  } finally {
    await f.cleanup()
  }
})
it("requires a reason, excludes the current user, and retains failed access changes", async () => {
  const f = await fixture("access")
  try {
    vi.mocked(updateAdminAccessLevel).mockRejectedValueOnce(
      new Error("更新できません")
    )
    await f.select("システム権限", "leader")
    expect(f.button("適用").disabled).toBe(true)
    await f.input("担当変更")
    await act(async () => f.button("適用").click())
    expect(updateAdminAccessLevel).toHaveBeenCalledTimes(2)
    expect(updateAdminAccessLevel).not.toHaveBeenCalledWith(
      "self",
      expect.anything()
    )
    expect(f.applied).not.toHaveBeenCalled()
    await act(async () => f.button("再試行").click())
    expect(updateAdminAccessLevel).toHaveBeenLastCalledWith("a", {
      accessLevel: "leader",
      reason: "担当変更",
    })
    expect(updateAdminAccessLevel).toHaveBeenCalledTimes(3)
    expect(f.applied).toHaveBeenCalledOnce()
  } finally {
    await f.cleanup()
  }
})
it("removes membership only for participating users and cancels without writing", async () => {
  const f = await fixture("years")
  try {
    await f.select("2026年度の変更", "remove")
    await f.select("2026年度の変更", "keep")
    expect(f.button("適用").disabled).toBe(true)
    await act(async () => f.button("キャンセル").click())
    expect(f.closed).toHaveBeenCalledOnce()
    expect(deactivateYearMembership).not.toHaveBeenCalled()
    await f.select("2026年度の変更", "remove")
    await act(async () => f.button("適用").click())
    expect(deactivateYearMembership).toHaveBeenCalledExactlyOnceWith(2026, "a")
  } finally {
    await f.cleanup()
  }
})
