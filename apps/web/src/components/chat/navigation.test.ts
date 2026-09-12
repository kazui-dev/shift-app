import { expect, it } from "vite-plus/test"
import { ChatNavigation } from "./navigation"

function fixture(roomId: string | undefined = "room", canGoBack = true) {
  const writes: unknown[] = []
  const navigation = new ChatNavigation(roomId, {
    canGoBack: () => canGoBack,
    back: () => writes.push("back"),
    list: () => writes.push("list"),
    open: (id, options) => writes.push({ id, ...options }),
  })
  return { navigation, writes }
}

it("preserves a room tap received before browser back finishes without flashing the list", () => {
  const { navigation, writes } = fixture()
  const views: (string | undefined)[] = []
  const unsubscribe = navigation.subscribe(() =>
    views.push(navigation.snapshot().roomId)
  )
  navigation.back()
  navigation.open("room")
  navigation.receive("room") // A replace/update of the old history entry is not completion.
  expect(writes).toEqual(["back"])
  navigation.receive(undefined, "back")
  expect(writes).toEqual([
    "back",
    { id: "room", replace: false, fromList: true },
  ])
  expect(views).toEqual([undefined, "room"])
  navigation.receive("room")
  expect(views).toEqual([undefined, "room"])
  unsubscribe()
  navigation.receive("other")
  expect(views).toEqual([undefined, "room"])
})

it("keeps only the latest selection during a pending back operation", () => {
  const { navigation, writes } = fixture()
  navigation.back()
  navigation.open("other")
  navigation.open("newest")
  navigation.receive(undefined, "back")
  expect(writes).toEqual([
    "back",
    { id: "newest", replace: false, fromList: true },
  ])
  expect(navigation.snapshot()).toEqual({
    roomId: "newest",
    retainedId: "newest",
  })
})

it("can reverse twice while history is pending without traversing twice", () => {
  const { navigation, writes } = fixture()
  navigation.back()
  navigation.resume()
  navigation.back()
  navigation.back()
  navigation.receive(undefined, "back")
  expect(writes).toEqual(["back"])
  expect(navigation.snapshot()).toEqual({
    roomId: undefined,
    retainedId: "room",
  })
})

it("accepts browser back and forward while idle and retains the last room", () => {
  const { navigation, writes } = fixture()
  navigation.receive(undefined, "back")
  navigation.receive("other")
  navigation.receive(undefined, "back")
  navigation.resume()
  expect(navigation.snapshot().roomId).toBe("other")
  expect(writes).toEqual([{ id: "other", replace: false, fromList: true }])
})

it("replaces a direct room entry with the list and leaves an empty list idle", () => {
  const { navigation, writes } = fixture("direct", false)
  navigation.back()
  navigation.receive(undefined)
  navigation.back()
  expect(writes).toEqual(["list"])
  const empty = new ChatNavigation(undefined, {
    canGoBack: () => false,
    back: () => {
      throw new Error("Unexpected history traversal")
    },
    list: () => {
      throw new Error("Unexpected navigation")
    },
    open: () => {
      throw new Error("Unexpected room")
    },
  })
  empty.resume()
  expect(empty.snapshot().retainedId).toBeUndefined()
})

it("does not duplicate the current room and preserves replacement and origin semantics", () => {
  const { navigation, writes } = fixture()
  navigation.open("room")
  navigation.open("other")
  navigation.open("default", true)
  expect(writes).toEqual([
    { id: "other", replace: false, fromList: false },
    { id: "default", replace: true, fromList: false },
  ])
})

it("replaces a removed chat with the list and never resumes its retained view", () => {
  const { navigation, writes } = fixture()
  navigation.remove("other")
  expect(writes).toEqual([])
  navigation.remove("room")
  expect(writes).toEqual(["list"])
  expect(navigation.snapshot()).toEqual({
    roomId: undefined,
    retainedId: undefined,
  })
  navigation.resume()
  expect(writes).toEqual(["list"])
})
