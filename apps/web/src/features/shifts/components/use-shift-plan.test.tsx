// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { useShiftPlan } from "./use-shift-plan"

it("marks repeated saves clean while retaining the latest revision and undo/redo", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const fixture = makeEditors()[0]
  if (!fixture) throw new Error("fixture")
  const source = fixture
  const host = document.createElement("div"),
    root = createRoot(host)
  document.body.append(host)
  function Editor() {
    const editor = useShiftPlan(source, false)
    return (
      <>
        <output aria-label="状態">
          {editor.dirty ? "未保存" : "保存済み"}
        </output>
        <output aria-label="版">
          {editor.version}:{editor.base.version}
        </output>
        <button
          onClick={() =>
            editor.update({ ...editor.plan, name: `変更${editor.version}` })
          }
        >
          編集
        </button>
        <button
          onClick={() =>
            editor.confirm(
              { ...editor.plan, version: editor.version },
              editor.version + 1
            )
          }
        >
          保存
        </button>
        <button onClick={editor.undo}>戻す</button>
        <button onClick={editor.redo}>進む</button>
      </>
    )
  }
  const click = async (name: string) => {
    const element = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === name
    )
    if (!element) throw new Error(name)
    await act(async () => element.click())
  }
  const status = () => host.querySelector('[aria-label="状態"]')?.textContent
  try {
    await act(async () => root.render(<Editor />))
    await click("編集")
    expect(status()).toBe("未保存")
    await click("保存")
    expect(status()).toBe("保存済み")
    await click("編集")
    expect(status()).toBe("未保存")
    await click("保存")
    expect(status()).toBe("保存済み")
    expect(host.querySelector('[aria-label="版"]')?.textContent).toBe("3:3")
    await click("戻す")
    expect(status()).toBe("未保存")
    await click("進む")
    expect(status()).toBe("保存済み")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
