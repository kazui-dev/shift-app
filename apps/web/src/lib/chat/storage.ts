import { clear, createStore, get, getMany, promisifyRequest } from "idb-keyval"
import * as v from "valibot"
import { stateSchema, type SavedChat } from "@/lib/chat/state"

let database = createStore("shift-chat", "messages")
const retained = new Map<string, Set<string>>()
const fileKey = (user: string, id: string) => ["image", user, id]
const metadataSchema = v.object({
  ...stateSchema.entries,
  drafts: v.record(
    v.string(),
    v.object({
      content: v.string(),
      files: v.array(
        v.omit(stateSchema.entries.drafts.value.entries.files.item, ["blob"])
      ),
    })
  ),
  queue: v.array(
    v.object({
      ...stateSchema.entries.queue.item.entries,
      files: v.array(
        v.omit(stateSchema.entries.drafts.value.entries.files.item, ["blob"])
      ),
    })
  ),
  originals: v.array(v.omit(stateSchema.entries.originals.item, ["blob"])),
})

async function access<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "InvalidStateError")
      throw error
    database = createStore("shift-chat", "messages")
    return run()
  }
}

export async function loadChat(user: string): Promise<unknown> {
  return access(async () => {
    const raw = await get<unknown>(["state", user], database)
    if (raw === undefined) {
      // Move the current live snapshot once; do not discard unsent messages on update.
      const existing = v.safeParse(
        stateSchema,
        await get<unknown>(user, database)
      )
      if (!existing.success) return undefined
      await saveChat(user, existing.output)
      return existing.output
    }
    const state = v.parse(metadataSchema, raw)
    const ids = [
      ...new Set(
        [...Object.values(state.drafts), ...state.queue]
          .flatMap((item) => item.files.map((file) => file.id))
          .concat(state.originals.map((original) => original.fileId))
      ),
    ]
    const values = await getMany<unknown>(
      ids.map((id) => fileKey(user, id)),
      database
    )
    const blobs = new Map(
      ids.map((id, index) => [id, v.parse(v.instance(Blob), values[index])])
    )
    retained.set(user, new Set(ids))
    const hydrate = (files: (typeof state.queue)[number]["files"]) =>
      files.map((file) => ({ ...file, blob: blobs.get(file.id) }))
    return {
      ...state,
      drafts: Object.fromEntries(
        Object.entries(state.drafts).map(([room, draft]) => [
          room,
          { ...draft, files: hydrate(draft.files) },
        ])
      ),
      queue: state.queue.map((message) => ({
        ...message,
        files: hydrate(message.files),
      })),
      originals: state.originals.map((original) => ({
        ...original,
        blob: blobs.get(original.fileId),
      })),
    }
  })
}

export async function saveChat(user: string, state: SavedChat) {
  const files = new Map<string, { blob: Blob }>([
    ...[...Object.values(state.drafts), ...state.queue].flatMap((item) =>
      item.files.map((file) => [file.id, file] as const)
    ),
    ...state.originals.map((original) => [original.fileId, original] as const),
  ])
  // Schema parsing deliberately strips Blob values from the lightweight snapshot.
  const metadata = v.parse(metadataSchema, state)
  await access(() =>
    database("readwrite", (store) => {
      const complete = promisifyRequest(store.transaction)
      try {
        for (const [id, file] of files) {
          if (!retained.get(user)?.has(id))
            store.put(file.blob, fileKey(user, id))
        }
        for (const id of retained.get(user) ?? []) {
          if (!files.has(id)) store.delete(fileKey(user, id))
        }
        store.put(metadata, ["state", user])
        store.delete(user)
      } catch (error) {
        store.transaction.abort()
        return complete.catch(() => {
          throw error
        })
      }
      return complete
    })
  )
  retained.set(user, new Set(files.keys()))
}

export async function clearChat() {
  await access(() => clear(database))
  retained.clear()
}
