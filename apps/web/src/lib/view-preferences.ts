import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react"
import * as v from "valibot"

/** Only view preferences belong here; drafts and scroll events have other lifetimes. */
export function createViewPreferences(user: string | null) {
  const prefix =
    user === null ? null : `shift-app:view:v1:${encodeURIComponent(user)}:`
  const values = new Map<string, string | null>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  const storageChanged = (event: StorageEvent) => {
    if (!prefix || event.storageArea !== window.localStorage) return
    if (event.key === null) values.clear()
    else if (event.key.startsWith(prefix))
      values.set(event.key.slice(prefix.length), event.newValue)
    else return
    emit()
  }
  return {
    get(key: string) {
      if (!values.has(key)) {
        let value: string | null = null
        try {
          if (prefix) value = localStorage.getItem(prefix + key)
        } catch {
          /* View controls remain usable without browser storage. */
        }
        values.set(key, value)
      }
      return values.get(key) ?? null
    },
    set(key: string, value: string) {
      values.set(key, value)
      try {
        if (prefix) localStorage.setItem(prefix + key, value)
      } catch {
        /* Keep the current selection in this page when storage is unavailable. */
      }
      emit()
    },
    subscribe(this: void, listener: () => void) {
      listeners.add(listener)
      if (listeners.size === 1 && typeof window !== "undefined")
        window.addEventListener("storage", storageChanged)
      return () => {
        listeners.delete(listener)
        if (!listeners.size && typeof window !== "undefined")
          window.removeEventListener("storage", storageChanged)
      }
    },
  }
}

export const ViewPreferencesContext = createContext<ReturnType<
  typeof createViewPreferences
> | null>(null)

function read<T>(
  raw: string | null,
  schema: v.GenericSchema<unknown, T>
): T | undefined {
  if (raw === null) return undefined
  try {
    const result = v.safeParse(schema, JSON.parse(raw))
    return result.success ? result.output : undefined
  } catch {
    return undefined
  }
}

export function useViewPreference<T>(
  key: string,
  schema: v.GenericSchema<unknown, T>,
  initial: NoInfer<T>
) {
  const context = useContext(ViewPreferencesContext)
  const local = useMemo(() => createViewPreferences(null), [])
  const store = context ?? local
  const snapshot = useCallback(() => store.get(key), [store, key])
  const raw = useSyncExternalStore(store.subscribe, snapshot, snapshot)
  const saved = useMemo(() => read(raw, schema), [raw, schema])
  const set = useCallback(
    (next: T) => {
      store.set(key, JSON.stringify(next))
    },
    [store, key]
  )
  const update = useCallback(
    (next: (current: T) => T) => {
      const current = read(store.get(key), schema) ?? initial
      store.set(key, JSON.stringify(next(current)))
    },
    [store, key, schema, initial]
  )
  return [saved ?? initial, set, update] as const
}

export const searchPreferenceSchema = v.string()
export const filterPreferenceSchema = v.object({
  include: v.array(v.string()),
  exclude: v.array(v.string()),
})
