type View = { roomId: string | undefined; retainedId: string | undefined }
type OpenOptions = { replace: boolean; fromList: boolean }
type History = {
  canGoBack: () => boolean
  back: () => void
  open: (id: string, options: OpenOptions) => void
  list: () => void
}

// The selected view changes immediately; asynchronous history traversal acknowledges it.
export class ChatNavigation {
  private history: History
  private openOptions: OpenOptions = { replace: false, fromList: true }
  private view: View
  private returning = false
  private listeners = new Set<() => void>()

  constructor(roomId: string | undefined, history: History) {
    this.history = history
    this.view = { roomId, retainedId: roomId }
  }

  snapshot = () => this.view

  subscribe = (changed: () => void) => {
    this.listeners.add(changed)
    return () => {
      this.listeners.delete(changed)
    }
  }

  open = (id: string, replace = false) => {
    if (this.view.roomId === id) return
    this.openOptions = {
      replace,
      fromList: !replace && (this.returning || this.view.roomId === undefined),
    }
    this.show(id)
    if (!this.returning) this.history.open(id, this.openOptions)
  }

  back = () => {
    if (this.view.roomId === undefined) return
    const traverse = !this.returning && this.history.canGoBack()
    this.returning ||= traverse
    this.show(undefined)
    if (traverse) this.history.back()
    else if (!this.returning) this.history.list()
  }

  remove = (id: string) => {
    if (this.view.retainedId !== id) return
    const selected = this.view.roomId === id
    this.returning = false
    this.view = { roomId: undefined, retainedId: undefined }
    for (const changed of this.listeners) changed()
    if (selected) this.history.list()
  }

  resume = () => {
    if (this.view.retainedId !== undefined) this.open(this.view.retainedId)
  }

  receive(
    roomId: string | undefined,
    action: "back" | "navigate" = "navigate"
  ) {
    if (this.returning) {
      if (action !== "back") return
      this.returning = false
      const desired = this.view.roomId
      if (desired !== undefined) {
        this.history.open(desired, this.openOptions)
        return
      }
    }
    this.show(roomId)
  }

  private show(roomId: string | undefined) {
    if (this.view.roomId === roomId) return
    this.view = { roomId, retainedId: roomId ?? this.view.retainedId }
    for (const changed of this.listeners) changed()
  }
}
