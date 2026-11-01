import { useEffect } from "react"

const overlays =
  'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

function visible(element: HTMLElement) {
  return (
    !element.closest(
      '[hidden], [inert], [aria-hidden="true"], [data-closed]'
    ) &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  )
}

export function SaveShortcuts() {
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "s"
      )
        return
      event.preventDefault()
      if (event.repeat || event.isComposing) return

      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>(overlays)
      ).filter(visible)
      const scope = dialogs.at(-1) ?? document
      const buttons = Array.from(
        scope.querySelectorAll<HTMLButtonElement>("button[data-save-shortcut]")
      ).filter(visible)
      const active = document.activeElement
      const form = active instanceof HTMLElement ? active.closest("form") : null
      const targets = form
        ? buttons.filter((button) => button.form === form)
        : buttons
      const target =
        targets.length === 1
          ? targets[0]
          : buttons.length === 1
            ? buttons[0]
            : null
      if (target && !target.matches(':disabled, [aria-disabled="true"]'))
        target.click()
    }
    window.addEventListener("keydown", save)
    return () => window.removeEventListener("keydown", save)
  }, [])
  return null
}
