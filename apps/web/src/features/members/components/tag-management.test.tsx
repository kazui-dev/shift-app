// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import type { ManagementScreenView } from "@/features/management/management-context"
import { LabelMembersManager } from "./label-members-manager"
import { TagEditor } from "./tag-editor"
import { changeMemberTags, createTag, updateTag, deleteTag } from "../api/tags"
import { changeMemberRoles } from "@/features/years/api/years"

vi.mock("../api/tags", async (original) => ({
  ...(await original<typeof import("../api/tags")>()),
  changeMemberTags: vi.fn<typeof changeMemberTags>(),
  createTag: vi.fn<typeof createTag>(),
  updateTag: vi.fn<typeof updateTag>(),
  deleteTag: vi.fn<typeof deleteTag>(),
}))
vi.mock("@/features/years/api/years", async (original) => ({
  ...(await original<typeof import("@/features/years/api/years")>()),
  changeMemberRoles: vi.fn<typeof changeMemberRoles>(),
}))
vi.mock("@/features/management/components/header-actions", () => ({
  ManagementHeaderActions: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
}))
vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    children,
    title,
    onOpenChange,
  }: {
    children: ReactNode
    title: string
    onOpenChange: (open: boolean) => void
  }) => (
    <dialog open aria-label={title}>
      <button onClick={() => onOpenChange(false)}>閉じる</button>
      {children}
    </dialog>
  ),
}))
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    title,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    title: string
    confirmLabel: string
    onConfirm: () => void
    onCancel: () => void
  }) => (
    <aside>
      {title}
      <button onClick={onConfirm}>{confirmLabel}</button>
      <button onClick={onCancel}>戻る</button>
    </aside>
  ),
}))
const tag = { id: "tag", name: "配布済み", memberIds: ["a"] }
const members = [
  {
    id: "a",
    displayName: "佐藤",
    studentId: "26EC1",
    image: null,
    roles: [{ id: "role", name: "受付", color: "#000000" }],
  },
  { id: "b", displayName: "鈴木", studentId: "26EC2", image: null, roles: [] },
]
async function fixture(content: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(keys.roster(2026), { members })
  client.setQueryData(keys.yearTags(2026), { tags: [tag] })
  vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>{content}</QueryClientProvider>
    )
  )
  const button = (label: string) => {
    const result = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === label
    )
    if (!result) throw new Error(`Missing button ${label}`)
    return result
  }
  const click = async (label: string) => {
    await act(async () => button(label).click())
  }
  const select = async (name: string) => {
    const input = host.querySelector<HTMLInputElement>(
      `input[aria-label="${name}を選択"]`
    )
    if (!input) throw new Error("Missing member checkbox")
    await act(async () => input.click())
  }
  return {
    host,
    button,
    click,
    select,
    cleanup: async () => {
      await act(async () => root.unmount())
      client.clear()
      host.remove()
      vi.unstubAllGlobals()
    },
  }
}
function Members({
  kind,
  editable = true,
}: {
  kind: "tag" | "role"
  editable?: boolean
}) {
  const [state, setState] = useState<ManagementScreenView>({
    search: "",
    scrollTop: 0,
  })
  return (
    <LabelMembersManager
      year={2026}
      kind={kind}
      id={kind}
      name="配布済み"
      memberIds={["a"]}
      canEdit={editable}
      canReadTags
      canEditMember={() => editable}
      onStatusChange={() => {}}
      view={{
        ...state,
        save: (patch) => setState((current) => ({ ...current, ...patch })),
      }}
    />
  )
}
it.each(["tag", "role"] as const)(
  "adds and removes only the selected %s members, retaining selection on failure",
  async (kind) => {
    const save = vi.mocked(
      kind === "tag" ? changeMemberTags : changeMemberRoles
    )
    save
      .mockReset()
      .mockRejectedValueOnce(new Error("失敗"))
      .mockResolvedValue(undefined)
    const f = await fixture(<Members kind={kind} />)
    try {
      expect(
        [...f.host.querySelectorAll("thead th")].map((cell) => cell.textContent)
      ).toEqual(["", "名前", "学籍番号", "ロール", "タグ"])
      await f.click("メンバーを追加")
      const dialog = f.host.querySelector("dialog")
      expect(dialog?.textContent).toContain("鈴木")
      expect(dialog?.textContent).not.toContain("佐藤")
      expect(f.button("追加").disabled).toBe(true)
      await f.select("鈴木")
      await f.click("閉じる")
      expect(f.host.querySelector("aside")?.textContent).toContain("選択を破棄")
      await f.click("戻る")
      await f.click("追加")
      expect(f.host.querySelector("dialog")).not.toBeNull()
      expect(f.button("追加").disabled).toBe(false)
      await f.click("追加")
      expect(f.host.querySelector("dialog")).toBeNull()
      const added =
        kind === "tag"
          ? { memberIds: ["b"], addTagIds: ["tag"], removeTagIds: [] }
          : { memberIds: ["b"], addRoleIds: ["role"], removeRoleIds: [] }
      expect(save).toHaveBeenLastCalledWith(2026, added)
      await f.select("佐藤")
      await f.click(kind === "tag" ? "タグから外す" : "ロールから外す")
      expect(save).toHaveBeenCalledTimes(2)
      await f.click("外す")
      expect(save).toHaveBeenLastCalledWith(
        2026,
        kind === "tag"
          ? { memberIds: ["a"], addTagIds: [], removeTagIds: ["tag"] }
          : { memberIds: ["a"], addRoleIds: [], removeRoleIds: ["role"] }
      )
    } finally {
      await f.cleanup()
    }
  }
)
it("keeps unauthorized membership controls disabled", async () => {
  const f = await fixture(<Members kind="role" editable={false} />)
  try {
    expect(f.button("メンバーを追加").disabled).toBe(true)
    expect(
      f.host.querySelector<HTMLInputElement>('input[aria-label="佐藤を選択"]')
        ?.disabled
    ).toBe(true)
  } finally {
    await f.cleanup()
  }
})
it("validates tag names, keeps a failed edit and confirms deletion", async () => {
  const close = vi.fn<() => void>()
  const deleted = vi.fn<() => void>()
  vi.mocked(updateTag)
    .mockReset()
    .mockRejectedValueOnce(new Error("重複"))
    .mockResolvedValue(undefined)
  vi.mocked(deleteTag).mockReset().mockResolvedValue(undefined)
  const f = await fixture(
    <TagEditor
      year={2026}
      tag={tag}
      onClose={close}
      onDeleted={deleted}
      onStatusChange={() => {}}
    />
  )
  try {
    expect(f.button("保存").disabled).toBe(true)
    const input = f.host.querySelector<HTMLInputElement>("#tag-name")
    if (!input) throw new Error("Missing tag name")
    const fill = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set?.call(input, value)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })
    }
    await fill("   ")
    expect(f.button("保存").disabled).toBe(true)
    await fill("変更後")
    const form = f.host.querySelector("form")
    if (!form) throw new Error("Missing tag form")
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    })
    expect(close).not.toHaveBeenCalled()
    expect(input.value).toBe("変更後")
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    })
    expect(updateTag).toHaveBeenLastCalledWith(2026, "tag", { name: "変更後" })
    expect(close).toHaveBeenCalledOnce()
    await f.click("タグを削除")
    expect(deleteTag).not.toHaveBeenCalled()
    await f.click("削除")
    expect(deleteTag).toHaveBeenCalledExactlyOnceWith(2026, "tag")
    expect(deleted).toHaveBeenCalledOnce()
  } finally {
    await f.cleanup()
  }
})
