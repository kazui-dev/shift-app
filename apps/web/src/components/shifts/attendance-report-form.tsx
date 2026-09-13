import { useState } from "react"
import {
  japanInputValue,
  japanLocalDateTime,
} from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import type { AttendanceData } from "./attendance-data"

export function ReportForm({
  report,
  pending,
  onSubmit,
  onCancel,
}: {
  report?: AttendanceData["reports"][number] | undefined
  pending: boolean
  onSubmit: (input: {
    kind: "late" | "absence"
    message: string
    eta: string | null
  }) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<"late" | "absence">(report?.kind ?? "late")
  const [message, setMessage] = useState(report?.message ?? "")
  const [eta, setEta] = useState(report?.eta ? japanInputValue(report.eta) : "")
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          kind,
          message,
          eta:
            kind === "late" && eta
              ? new Date(japanLocalDateTime(eta)).toISOString()
              : null,
        })
      }}
    >
      <div className="flex gap-2">
        {(["late", "absence"] as const).map((k) => (
          <Button
            key={k}
            type="button"
            variant={kind === k ? "default" : "outline"}
            onClick={() => setKind(k)}
          >
            {k === "late" ? "遅刻" : "欠勤"}
          </Button>
        ))}
      </div>
      {kind === "late" && (
        <label htmlFor="report-eta" className="block space-y-2 text-sm">
          到着見込み（未定なら空欄）
          <Input
            id="report-eta"
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </label>
      )}
      <label htmlFor="report-message" className="block space-y-2 text-sm">
        理由
        <Textarea
          id="report-message"
          required
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          戻る
        </Button>
        <Button disabled={pending || !message.trim()}>送信</Button>
      </div>
    </form>
  )
}
