import type { UploadProgress } from "@/features/chat/lib/store"

const radius = 15
const circumference = 2 * Math.PI * radius
/** The share of the ring the bytes fill; the rest waits on the server. */
const bytesShare = 0.85
/** Where the ring creeps to while the server stores the image. */
const storingShare = 0.97

/**
 * How far a sending image's upload has gone, drawn inside its own frame so
 * nothing around it moves. The ring only ever moves forward. A stopped upload
 * shows nothing here; its message offers to send again.
 */
export function UploadOverlay({
  progress,
  name,
}: {
  progress: UploadProgress | undefined
  name: string
}) {
  if (!progress || progress === "failed") return null
  const sent =
    progress.total > 0 ? Math.min(1, progress.sent / progress.total) : 0
  // Every byte is sent; the server still reads and stores the image.
  const storing = sent >= 1
  const filled = storing ? storingShare : sent * bytesShare
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
      <progress
        className="sr-only"
        aria-label={`${name}を送信中`}
        max={100}
        value={Math.round(filled * 100)}
      />
      <svg viewBox="0 0 36 36" aria-hidden className="size-9 -rotate-90">
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
          strokeDashoffset={circumference * (1 - filled)}
          className={`transition-[stroke-dashoffset] motion-reduce:transition-none ${storing ? "duration-[6s] ease-out" : "duration-200 ease-linear"}`}
        />
      </svg>
    </span>
  )
}
