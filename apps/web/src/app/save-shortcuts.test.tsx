// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { SaveShortcuts } from "./save-shortcuts"

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
    item: () => null,
    [Symbol.iterator]: () => new Array<DOMRect>()[Symbol.iterator](),
  })
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<SaveShortcuts />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function shortcut(options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "s",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...options,
  })
  document.activeElement?.dispatchEvent(event)
  return event
}
function button(parent: HTMLElement, disabled = false) {
  const node = document.createElement("button")
  node.dataset.saveShortcut = ""
  node.disabled = disabled
  parent.append(node)
  const click = vi.fn<() => void>()
  node.addEventListener("click", click)
  return { node, click }
}
it.each([{ ctrlKey: true }, { ctrlKey: false, metaKey: true }])(
  "runs the existing save action and prevents browser save (%o)",
  (keys) => {
    const action = button(document.body)
    expect(shortcut(keys).defaultPrevented).toBe(true)
    expect(action.click).toHaveBeenCalledTimes(1)
  }
)
it("respects disabled controls, ignores repeats and leaves other shortcuts alone", () => {
  const action = button(document.body, true)
  expect(shortcut().defaultPrevented).toBe(true)
  action.node.disabled = false
  shortcut({ repeat: true })
  shortcut({ isComposing: true })
  expect(shortcut({ shiftKey: true }).defaultPrevented).toBe(false)
  expect(shortcut({ ctrlKey: false }).defaultPrevented).toBe(false)
  expect(action.click).not.toHaveBeenCalled()
})
it("saves only the top dialog and never falls back to a background save", () => {
  const page = button(document.body)
  const dialog = document.createElement("dialog")
  dialog.open = true
  document.body.append(dialog)
  const local = button(dialog)
  shortcut()
  expect(local.click).toHaveBeenCalledTimes(1)
  expect(page.click).not.toHaveBeenCalled()
  local.node.disabled = true
  shortcut()
  const confirmation = document.createElement("dialog")
  confirmation.open = true
  document.body.append(confirmation)
  shortcut()
  expect(local.click).toHaveBeenCalledTimes(1)
  expect(page.click).not.toHaveBeenCalled()
})
it("uses native validation and an external form submit button", () => {
  const form = document.createElement("form")
  form.id = "editor"
  const input = document.createElement("input")
  input.required = true
  form.append(input)
  document.body.append(form)
  const submit = vi.fn<(event: Event) => void>((event) =>
    event.preventDefault()
  )
  form.addEventListener("submit", submit)
  const action = button(document.body)
  action.node.type = "submit"
  action.node.setAttribute("form", form.id)
  input.focus()
  shortcut()
  expect(submit).not.toHaveBeenCalled()
  input.value = "ready"
  shortcut()
  expect(submit).toHaveBeenCalledTimes(1)
})
it("ignores hidden controls and chooses the focused form when several editors exist", () => {
  const hidden = button(document.body)
  hidden.node.hidden = true
  const form = document.createElement("form")
  const input = document.createElement("input")
  form.append(input)
  document.body.append(form)
  const action = button(form)
  action.node.type = "button"
  const other = button(document.body)
  shortcut()
  expect(other.click).not.toHaveBeenCalled()
  input.focus()
  shortcut()
  expect(action.click).toHaveBeenCalledTimes(1)
  expect(hidden.click).not.toHaveBeenCalled()
  expect(other.click).not.toHaveBeenCalled()
})
