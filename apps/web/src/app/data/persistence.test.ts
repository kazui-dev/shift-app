import { expect, it } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import { QueryClient, dehydrate } from "@tanstack/react-query"
import { boundPersistedClient } from "./persistence"
it("bounds recent histories without losing older-page cursors and excludes privileged data", () => {
  const client = new QueryClient()
  for (let i = 0; i < 25; i++)
    client.setQueryData(
      ["chat-messages", String(i)],
      {
        pages: Array.from({ length: 5 }, () => ({
          messages: [],
          hasMore: true,
        })),
        pageParams: [null, 50, 40, 30, 20],
      },
      { updatedAt: i + 1 }
    )
  client.setQueryData(["admin", "users"], { private: true })
  client.setQueryData(["chat-messages", "invalid"], { pages: "invalid" })
  const bounded = boundPersistedClient({
    timestamp: 1,
    buster: "test",
    clientState: dehydrate(client),
  })
  const queries = bounded.clientState.queries
  expect(queries).toHaveLength(19)
  expect(queries.some((query) => query.queryKey[0] === "admin")).toBe(false)
  expect(queries[0]?.queryKey).toEqual(keys.chatMessages("24"))
  expect(queries[0]?.state.data).toEqual({
    pages: Array.from({ length: 3 }, () => ({ messages: [], hasMore: true })),
    pageParams: [null, 50, 40],
  })
  expect(client.getQueryData(["chat-messages", "24"])).toMatchObject({
    pageParams: [null, 50, 40, 30, 20],
  })
  client.clear()
})

it("caps a page expanded by live messages and resumes older history at the retained boundary", () => {
  const client = new QueryClient()
  const messages = Array.from({ length: 125 }, (_, index) => ({
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    sequence: index + 1,
    memberDisplayName: "メンバー",
    memberImage: null,
    content: "本文",
    attachments: [],
    linkPreview: null,
    version: 1,
    createdAt: "2026-09-12T00:00:00.000Z",
  }))
  client.setQueryData(["chat-messages", "room"], {
    pages: [{ messages, hasMore: false }],
    pageParams: [null],
  })
  const result = boundPersistedClient({
    timestamp: 1,
    buster: "test",
    clientState: dehydrate(client),
  })
  expect(result.clientState.queries[0]?.state.data).toEqual({
    pages: [{ messages: messages.slice(-100), hasMore: true }],
    pageParams: [null],
  })
  client.clear()
})
