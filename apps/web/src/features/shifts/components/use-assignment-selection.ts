import { useState } from "react"

export type AssignmentSelection = {
  active: boolean
  keys: string[]
  available: string[]
  replace: (keys: string[]) => void
  toggle: (key: string) => void
}
export function useAssignmentSelection(scope: string, available: string[]) {
  const [state, setState] = useState<{
    scope: string
    active: boolean
    revision: number
    keys: string[]
  }>({ scope, active: false, keys: [], revision: 0 })
  const keys =
    state.scope === scope && state.active
      ? state.keys.filter((key) => available.includes(key))
      : []
  const active = keys.length > 0
  function replace(next: string[]) {
    setState((current) => ({
      scope,
      active: true,
      keys: next,
      revision: current.revision + 1,
    }))
  }
  return {
    active,
    available,
    revision: state.revision,
    keys,
    replace,
    end: () =>
      setState((current) => ({
        scope,
        active: false,
        keys: [],
        revision: current.revision + 1,
      })),
    toggle: (key: string) =>
      replace(
        keys.includes(key)
          ? keys.filter((value) => value !== key)
          : [...keys, key]
      ),
  }
}
