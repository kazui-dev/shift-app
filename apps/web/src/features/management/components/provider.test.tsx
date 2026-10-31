// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { ManagementProvider } from "./provider"
import { ViewPreferencesProvider } from "@/app/view-preferences-provider"
import { useShiftView } from "@/features/shifts/shift-view-context"
import { useManagementScreenView } from "../management-context"
import { emptyFilter } from "@workspace/ui/lib/filters"

vi.mock("@/features/management/use-management-year", () => ({
  useManagementYearState: () => ({ year: 2026 }),
}))
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
})

function Controls({ year, shift }: { year: number; shift: string }) {
  const view = useShiftView(year, shift)
  const members = useManagementScreenView(`members:${year}`)
  const users = useManagementScreenView("users")
  return (
    <>
      <span data-testid="user-sort">
        {users.sort?.column}:{String(users.sort?.descending)}
      </span>
      <button
        onClick={() =>
          users.save({ sort: { column: "years", descending: true } })
        }
      >
        sort years
      </button>
      <button
        onClick={() =>
          users.save({ sort: { column: "accessLevel", descending: false } })
        }
      >
        sort access
      </button>
      <output>
        {view.filters?.availability.include.join(",") ?? "available"}:
        {view.scrollTop}:{members.search}:
        {members.filters?.roles?.exclude.join(",")}
      </output>
      <button
        onClick={() =>
          view.save({
            filters: {
              search: "",
              roles: emptyFilter(),
              availability: emptyFilter(),
            },
          })
        }
      >
        clear
      </button>
      <button onClick={() => view.save({ scrollTop: 700 })}>scroll</button>
      <button
        onClick={() =>
          members.save({
            search: "佐藤",
            filters: { roles: { include: [], exclude: ["role"] } },
          })
        }
      >
        members
      </button>
      <button
        onClick={() => members.save({ filters: { roles: emptyFilter() } })}
      >
        clear members
      </button>
    </>
  )
}
async function page(user = "alice", year = 2026, shift = "a") {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(
      <ViewPreferencesProvider user={user}>
        <ManagementProvider>
          <Controls year={year} shift={shift} />
        </ManagementProvider>
      </ViewPreferencesProvider>
    )
  )
  return {
    text: () => host.querySelector("output")?.textContent,
    sort: () => host.querySelector('[data-testid="user-sort"]')?.textContent,
    click: async (name: string) => {
      const button = [...host.querySelectorAll("button")].find(
        (item) => item.textContent === name
      )
      if (!button) throw new Error("Missing control")
      await act(async () => button.click())
    },
    close: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

it("restores explicit clearing after a fresh page, isolates users/years/shifts and never writes scroll", async () => {
  const first = await page()
  const writes = vi.spyOn(Storage.prototype, "setItem")
  await first.click("clear")
  await first.click("members")
  const count = writes.mock.calls.length
  await first.click("scroll")
  expect(writes).toHaveBeenCalledTimes(count)
  await first.close()
  writes.mockRestore()
  const restored = await page()
  expect(restored.text()).toBe(":0:佐藤:role")
  await restored.click("clear members")
  await restored.close()
  const again = await page()
  expect(again.text()).toBe(":0:佐藤:")
  await again.close()
  const otherShift = await page("alice", 2026, "b")
  expect(otherShift.text()).toBe("available:0:佐藤:")
  await otherShift.close()
  const otherUser = await page("bob")
  expect(otherUser.text()).toBe("available:0::")
  await otherUser.close()
  const otherYear = await page("alice", 2027)
  expect(otherYear.text()).toBe("available:0::")
  await otherYear.close()
})

it("restores user column sorting across reloads without sharing it with another user", async () => {
  const first = await page()
  await first.click("sort years")
  await first.close()
  const restored = await page()
  expect(restored.sort()).toBe("years:true")
  await restored.click("sort access")
  await restored.close()
  const again = await page()
  expect(again.sort()).toBe("accessLevel:false")
  await again.close()
  const other = await page("bob")
  expect(other.sort()).toBe(":undefined")
  await other.close()
})
