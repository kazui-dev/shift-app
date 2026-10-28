// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { MemberTagEditor } from "./member-tag-editor"
import { TagManager } from "./tag-manager"
import { changeMemberTags, deleteTag } from "../api/tags"
import { ApiError } from "@/lib/http/client"

vi.mock("../api/tags", () => ({
  changeMemberTags: vi.fn<typeof changeMemberTags>(),
  deleteTag: vi.fn<typeof deleteTag>(),
  saveTag: vi.fn<typeof import("../api/tags").saveTag>(),
}))
vi.mock("@workspace/ui/lib/toast", () => ({
  toast: {
    success: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>(),
  },
}))
vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    children,
    onOpenChange,
  }: {
    children: ReactNode
    onOpenChange: (open: boolean) => void
  }) => (
    <section>
      <button onClick={() => onOpenChange(false)}>閉じる</button>
      {children}
    </section>
  ),
}))
vi.mock("@/components/select-field", () => ({
  SelectField: ({
    value,
    options,
    onValueChange,
    disabled,
  }: {
    value: string
    options: { value: string; label: string }[]
    onValueChange: (value: string) => void
    disabled: boolean
  }) => (
    <select
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
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    title,
    description,
    onConfirm,
    onCancel,
  }: {
    title: string
    description: string
    onConfirm: () => void
    onCancel: () => void
  }) => (
    <aside>
      {title}
      {description}
      <button onClick={onConfirm}>確認</button>
      <button onClick={onCancel}>戻る</button>
    </aside>
  ),
}))

const tags = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "準備済み",
    memberIds: [],
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "確認済み",
    memberIds: ["member-a"],
  },
]
function fixture() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const render = (node: ReactNode) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>{node}</QueryClientProvider>
      )
    )
  const button = (text: string) => {
    const result = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === text
    )
    if (!result) throw new Error(`missing button ${text}`)
    return result
  }
  const cleanup = async () => {
    await act(async () => root.unmount())
    host.remove()
    client.clear()
    vi.unstubAllGlobals()
  }
  return { host, render, button, cleanup }
}

it("retains a bulk change through tag search, a canceled close, and a failed save", async () => {
  const { host, render, button, cleanup } = fixture()
  const onClose = vi.fn<() => void>()
  const onApplied = vi.fn<() => void>()
  const onDirtyChange = vi.fn<(dirty: boolean) => void>()
  const save = vi.mocked(changeMemberTags)
  save
    .mockRejectedValueOnce(new ApiError("再試行してください", 500, "RETRY"))
    .mockResolvedValue(undefined)
  try {
    await render(
      <MemberTagEditor
        year={2026}
        tags={tags}
        memberIds={["member-a", "member-b"]}
        onClose={onClose}
        onApplied={onApplied}
        onDirtyChange={onDirtyChange}
      />
    )
    const choice = host.querySelector("select")
    if (!choice) throw new Error("missing tag choice")
    await act(async () => {
      choice.value = "add"
      choice.dispatchEvent(new Event("change", { bubbles: true }))
    })
    const search = host.querySelector("input")
    if (!search) throw new Error("missing tag search")
    const inputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )
    await act(async () => {
      inputValue?.set?.call(search, "確認")
      search.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(host.textContent).not.toContain("準備済み")
    await act(async () => button("閉じる").click())
    expect(host.querySelector("aside")?.textContent).toContain("変更を破棄")
    await act(async () => button("戻る").click())
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => button("適用").click())
    expect(onApplied).not.toHaveBeenCalled()
    expect(button("適用").disabled).toBe(false)
    await act(async () => button("適用").click())
    expect(save).toHaveBeenLastCalledWith(2026, {
      memberIds: ["member-a", "member-b"],
      addTagIds: [tags[0]?.id],
      removeTagIds: [],
    })
    expect(onApplied).toHaveBeenCalledOnce()
    expect(onDirtyChange).toHaveBeenCalledWith(true)
  } finally {
    await cleanup()
  }
})

it("shows the affected member count and deletes a tag only after confirmation", async () => {
  const { host, render, cleanup } = fixture()
  const remove = vi.mocked(deleteTag).mockResolvedValue(undefined)
  try {
    await render(
      <TagManager
        year={2026}
        tags={[tags[1]].filter((tag) => tag !== undefined)}
        onClose={() => {}}
        onDirtyChange={() => {}}
      />
    )
    const deletion = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === "削除"
    )
    if (!deletion) throw new Error("missing delete button")
    await act(async () => deletion.click())
    expect(host.querySelector("aside")?.textContent).toContain("付与中の1人")
    expect(remove).not.toHaveBeenCalled()
    const confirm = host.querySelector("aside button")
    if (!(confirm instanceof HTMLButtonElement))
      throw new Error("missing confirmation")
    await act(async () => confirm.click())
    expect(remove).toHaveBeenCalledWith(2026, tags[1]?.id)
  } finally {
    await cleanup()
  }
})
