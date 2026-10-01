type Anchor = {
  id: string
  offset: number
  index?: number
  sequence?: number | null
}
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
  measured?: (id: string) => boolean
  nearest?: (index: number, sequence?: number | null) => string | null
}

/** How far above the bottom a reader still counts as watching the latest. */
const NEAR_BOTTOM = 48

// One owner for render, resize, user scrolling and explicit jumps.
export class MessageScroll {
  private initialized = false
  private following = true
  private jumping = false
  private targetId: string | null = null
  private targetSmooth = false
  private targetOffset: number | null = null
  private movingTo: number | null = null
  private anchor: Anchor | null = null
  private bottomGap = Number.POSITIVE_INFINITY
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
    if (this.targetId) {
      const destination = this.targetTop(this.targetId)
      if (destination !== null) this.move(destination, this.targetSmooth)
    } else if (this.following || this.jumping) {
      this.move(view.extent(), this.jumping)
    } else if (this.bottomGap <= NEAR_BOTTOM) {
      // Near the latest, keyboards and a growing composer keep the bottom in view.
      this.move(view.extent() - view.height() - this.bottomGap, false)
    } else if (this.anchor) {
      if (
        view.locate(this.anchor.id) === null &&
        this.anchor.index !== undefined
      ) {
        const id = view.nearest?.(this.anchor.index, this.anchor.sequence)
        if (id) this.anchor = { ...this.anchor, id }
      }
      const offset = view.locate(this.anchor.id)
      if (offset !== null)
        this.move(view.top() + offset - this.anchor.offset, false)
    }
    this.remember()
    this.publish()
  }

  scroll() {
    const distance = this.distance()
    if (this.targetId) {
      const destination = this.targetTop(this.targetId)
      if (
        destination === null ||
        (Math.abs(destination - this.surface.top()) <= 1 &&
          (!this.surface.measured ||
            (this.targetOffset !== null &&
              this.surface.measured(this.targetId))))
      )
        this.targetId = null
    }
    if (this.jumping && distance <= 1) this.jumping = false
    if (!this.jumping && !this.targetId && distance <= 1) this.following = true
    this.remember()
    this.publish()
  }

  private targetTop(id: string, alignment = this.targetOffset) {
    const offset = this.surface.locate(id)
    if (offset === null) return null
    return Math.max(
      0,
      Math.min(
        this.surface.top() + offset - (alignment ?? this.surface.height() / 3),
        this.surface.extent() - this.surface.height()
      )
    )
  }

  arrived(id: string) {
    const destination = this.targetTop(id)
    return (
      destination !== null &&
      Math.abs(destination - this.surface.top()) <= 1 &&
      (this.surface.measured?.(id) ?? true)
    )
  }

  isTargeting(id: string) {
    return this.targetId === id
  }

  finishTarget(id: string) {
    if (this.targetId === id) {
      this.targetId = null
      this.movingTo = null
      this.scroll()
    }
  }

  target(id: string, smooth: boolean, offset: number | null = null) {
    const destination = this.targetTop(id, offset)
    if (destination === null) return false
    this.read()
    this.targetOffset = offset
    this.targetId = id
    this.targetSmooth = smooth
    this.move(destination, smooth)
    this.scroll()
    return true
  }

  latest(smooth: boolean) {
    this.targetId = null
    this.jumping = smooth
    this.following = !smooth
    this.move(this.surface.extent(), smooth)
    this.scroll()
  }

  interrupt() {
    if (!this.jumping && !this.targetId) return
    this.read()
  }

  read() {
    if (this.jumping || this.targetId)
      this.surface.move(this.surface.top(), false)
    this.jumping = false
    this.targetId = null
    this.movingTo = null
    this.following = false
    this.remember()
    this.publish()
  }

  // Called before publishing an outgoing row; layout settles it before paint.
  follow() {
    this.targetId = null
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
    return this.initialized && this.distance() <= NEAR_BOTTOM
  }

  private distance() {
    return Math.max(
      0,
      this.surface.extent() - this.surface.height() - this.surface.top()
    )
  }

  private remember() {
    this.anchor = this.surface.anchor()
    this.bottomGap = this.distance()
  }

  private move(top: number, smooth: boolean) {
    const destination = Math.max(
      0,
      Math.min(top, this.surface.extent() - this.surface.height())
    )
    // Even a same-position scrollTo can interrupt a native gesture or momentum.
    if (!smooth) this.movingTo = null
    if (
      Math.abs(destination - this.surface.top()) > 0.5 &&
      (!smooth || this.movingTo !== destination)
    ) {
      this.movingTo = smooth ? destination : null
      this.surface.move(top, smooth)
    }
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
