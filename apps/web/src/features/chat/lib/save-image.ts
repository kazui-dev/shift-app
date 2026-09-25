/**
 * Saves an original: on a phone through the share sheet, which can save it to
 * Photos; on a computer, or when the share sheet cannot open, as a download.
 */
export async function saveImage(blob: Blob, name: string, share: boolean) {
  const file = new File([blob], name, { type: blob.type })
  if (share && "canShare" in navigator && navigator.canShare({ files: [file] }))
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      // Closing the share sheet is a choice; anything else falls back to a download.
      if (error instanceof DOMException && error.name === "AbortError") return
    }
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
