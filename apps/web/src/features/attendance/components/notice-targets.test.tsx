// @vitest-environment jsdom
import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { NoticeTargets } from "./notice-targets"

it("keeps multiple selections across search and allows removing selected items", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div"),
    root = createRoot(host)
  document.body.append(host)
  function Form() {
    const [value, setValue] = useState<string[]>([])
    return (
      <NoticeTargets
        label="ロール"
        options={[
          { id: "a", name: "受付" },
          { id: "b", name: "広報" },
        ]}
        value={value}
        onChange={setValue}
      />
    )
  }
  const box = (name: string) => {
    const label = [...host.querySelectorAll("label")].find(
      (el) => el.textContent === name
    )
    const input = label?.querySelector("input")
    if (!input) throw new Error(name)
    return input
  }
  const search = async (value: string) => {
    const input = host.querySelector('input[type="search"]')
    if (!(input instanceof HTMLInputElement)) throw new Error("search")
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )
    if (!descriptor?.set) throw new Error("setter")
    await act(async () => {
      descriptor.set?.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
  try {
    await act(async () => root.render(<Form />))
    await act(async () => box("受付").click())
    await search("広報")
    await act(async () => box("広報").click())
    expect(host.textContent).toContain("2件選択")
    const remove = host.querySelector('button[aria-label="受付の選択を解除"]')
    if (!(remove instanceof HTMLButtonElement)) throw new Error("remove")
    await act(async () => remove.click())
    expect(host.textContent).toContain("1件選択")
    await search("")
    expect(box("受付").checked).toBe(false)
    expect(box("広報").checked).toBe(true)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
