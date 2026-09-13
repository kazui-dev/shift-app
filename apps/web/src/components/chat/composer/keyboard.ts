/** How far the viewport must shrink below its full height to be a keyboard. */
const keyboardHeight = 120

export type KeyboardState = {
  /** The width the full height was measured at; rotating starts over. */
  width: number
  /** The tallest viewport seen at this width, without a keyboard. */
  full: number
  open: boolean
}

/**
 * Whether the on-screen keyboard is open after the visual viewport resized.
 * The layout shrinks with the keyboard, so the tallest height seen at the same
 * width stands for the screen without it.
 */
export function keyboardAfterResize(
  state: KeyboardState | null,
  viewport: { width: number; height: number }
): KeyboardState {
  const full =
    state && state.width === viewport.width
      ? Math.max(state.full, viewport.height)
      : viewport.height
  return {
    width: viewport.width,
    full,
    open: full - viewport.height > keyboardHeight,
  }
}
