type Anchor = { id: string; offset: number }
export type ScrollPosition = {
  top: number
  following: boolean
  anchor: Anchor | null
}
export type ScrollStatus = { atBottom: boolean; showLatest: boolean }
type Surface = {
  top: () => number
  height: () => number
  extent: () => number
  move: (top: number, smooth: boolean) => void
  anchor: () => Anchor | null
  locate: (id: string) => number | null
}

// One owner for render, resize, user scrolling and explicit jumps.
export class MessageScroll {
  private initialized = false
  private following = true
  private jumping = false
  private anchor: Anchor | null = null
  private showLatest = false
  private surface: Surface
  private change: (status: ScrollStatus) => void
  private saved: ScrollPosition | undefined

  constructor(
    surface: Surface,
    change: (status: ScrollStatus) => void,
    saved?: ScrollPosition
  ) {
    this.surface = surface
    this.change = change
    this.saved = saved
  }

  layout(initialTop?: number) {
    const view = this.surface
    if (!this.initialized) {
      this.initialized = true
      this.following = this.saved?.following ?? initialTop === undefined
      this.anchor = this.saved?.anchor ?? null
      this.move(this.saved?.top ?? initialTop ?? view.extent(), false)
    }
    if (this.following || this.jumping) {
      this.move(view.extent(), this.jumping)
    } else if (this.anchor) {
      const offset = view.locate(this.anchor.id)
      if (offset !== null)
        this.move(view.top() + offset - this.anchor.offset, false)
    }
    this.remember()
    this.publish()
  }

  scroll() {
    const distance = this.distance()
    if (this.jumping && distance <= 1) this.jumping = false
    if (!this.jumping && distance <= 1) this.following = true
    this.remember()
    this.publish()
  }

  latest(smooth: boolean) {
    this.jumping = smooth
    this.following = !smooth
    this.move(this.surface.extent(), smooth)
    this.scroll()
  }

  interrupt() {
    if (!this.jumping) return
    this.read()
  }

  read() {
    if (this.jumping) this.surface.move(this.surface.top(), false)
    this.jumping = false
    this.following = false
    this.remember()
    this.publish()
  }

  // Called before publishing an outgoing row; layout settles it before paint.
  follow() {
    this.jumping = false
    this.following = true
  }

  position(): ScrollPosition {
    return {
      top: this.surface.top(),
      following: this.following,
      anchor: this.anchor,
    }
  }

  isAtBottom() {
    return this.initialized && this.distance() <= 48
  }

  private distance() {
    return Math.max(
      0,
      this.surface.extent() - this.surface.height() - this.surface.top()
    )
  }

  private remember() {
    this.anchor = this.surface.anchor()
  }

  private move(top: number, smooth: boolean) {
    const destination = Math.max(
      0,
      Math.min(top, this.surface.extent() - this.surface.height())
    )
    // Even a same-position scrollTo can interrupt a native gesture or momentum.
    if (Math.abs(destination - this.surface.top()) > 0.5)
      this.surface.move(top, smooth)
  }

  private publish() {
    const distance = this.distance()
    // Following a new message and offering a jump back are different decisions.
    const threshold = Math.max(160, this.surface.height() / 2)
    this.showLatest =
      !this.jumping && distance > threshold * (this.showLatest ? 0.5 : 1)
    this.change({ atBottom: this.isAtBottom(), showLatest: this.showLatest })
  }
}
