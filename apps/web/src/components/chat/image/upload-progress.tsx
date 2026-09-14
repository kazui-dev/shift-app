import { RotateCw } from "lucide-react"
import type { UploadProgress } from "@/lib/chat/store"

const radius = 15
const circumference = 2 * Math.PI * radius

/**
 * How far an image's upload has gone, drawn over the image inside its own
 * frame so nothing around it moves. A stopped upload offers to try again.
 */
export function UploadOverlay({
  progress,
  name,
  onRetry,
}: {
  progress: UploadProgress | undefined
  name: string
  onRetry: () => void
}) {
  if (!progress) return null
  if (progress === "failed")
    return (
      <button
        type="button"
        aria-label={`${name}のアップロードを再試行`}
        onPointerDown={(event) => event.preventDefault()}
        onClick={onRetry}
        className="absolute inset-0 flex items-center justify-center bg-black/45 text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
      >
        <RotateCw className="size-5" aria-hidden />
      </button>
    )
  const sent =
    progress.total > 0 ? Math.min(1, progress.sent / progress.total) : 0
  // Every byte is sent; the server still reads and stores the image.
  const storing = sent >= 1
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
      <progress
        className="sr-only"
        aria-label={`${name}をアップロード中`}
        max={100}
        {...(storing ? {} : { value: Math.round(sent * 100) })}
      />
      <svg
        viewBox="0 0 36 36"
        aria-hidden
        className={`size-9 -rotate-90 motion-reduce:animate-none ${storing ? "animate-spin" : ""}`}
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.35)"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (storing ? 0.25 : sent))}
          className="transition-[stroke-dashoffset] duration-200 motion-reduce:transition-none"
        />
      </svg>
    </span>
  )
}
