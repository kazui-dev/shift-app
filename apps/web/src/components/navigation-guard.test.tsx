// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { expect, it, vi } from "vite-plus/test"
import { NavigationGuard } from "./navigation-guard"

it("confirms dirty navigation, blocks pending saves without a dead-end dialog, and allows the successful save destination", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  window.history.replaceState(null, "", "/")
  vi.stubGlobal("scrollTo", vi.fn())
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  let state = { dirty: true, pending: false, allowed: false }
  function Editor() {
    return (
      <NavigationGuard
        dirty={state.dirty}
        pending={state.pending}
        allowNavigation={() => state.allowed}
      />
    )
  }
  const route = createRootRoute()
  const editor = createRoute({
    getParentRoute: () => route,
    path: "/",
    component: Editor,
  })
  const next = createRoute({
    getParentRoute: () => route,
    path: "/calendar",
    component: () => <p>destination</p>,
  })
  const router = createRouter({
    routeTree: route.addChildren([editor, next]),
    history: createBrowserHistory(),
  })
  const render = () =>
    act(async () => {
      root.render(<RouterProvider router={router} />)
    })
  const navigate = () =>
    act(async () => {
      void router.navigate({ to: "/calendar" })
    })
  const click = async (label: string) => {
    const button = [...document.querySelectorAll("button")].find(
      (node) => node.textContent === label
    )
    if (!button) throw new Error(`Missing ${label}`)
    await act(async () => button.click())
  }
  try {
    await act(async () => {
      await router.load()
    })
    await render()
    await navigate()
    expect(document.body.textContent).toContain(
      "未保存の変更を破棄して移動しますか"
    )
    await click("キャンセル")
    expect(router.state.location.pathname).toBe("/")
    await navigate()
    await click("移動する")
    expect(router.state.location.pathname).toBe("/calendar")
    state = { dirty: false, pending: true, allowed: false }
    await act(async () => {
      await router.navigate({ to: "/" })
    })
    await navigate()
    expect(router.state.location.pathname).toBe("/")
    expect(document.body.textContent).not.toContain("移動する")
    const unload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    state.allowed = true
    await navigate()
    expect(router.state.location.pathname).toBe("/calendar")
    state = { dirty: false, pending: false, allowed: false }
    await act(async () => {
      await router.navigate({ to: "/" })
    })
    await navigate()
    expect(router.state.location.pathname).toBe("/calendar")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
