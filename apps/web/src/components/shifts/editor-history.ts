export type EditHistory<T> = { past: T[]; present: T; future: T[] }
export function change<T>(history: EditHistory<T>, value: T): EditHistory<T> {
  return {
    past: [...history.past.slice(-99), history.present],
    present: value,
    future: [],
  }
}
export function undo<T>(history: EditHistory<T>): EditHistory<T> {
  const value = history.past.at(-1)
  return value === undefined
    ? history
    : {
        past: history.past.slice(0, -1),
        present: value,
        future: [history.present, ...history.future],
      }
}
export function redo<T>(history: EditHistory<T>): EditHistory<T> {
  const value = history.future[0]
  return value === undefined
    ? history
    : {
        past: [...history.past, history.present],
        present: value,
        future: history.future.slice(1),
      }
}
