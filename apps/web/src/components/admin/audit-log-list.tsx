import type { AdminAuditLog } from "@workspace/shared/auth"

function auditSummary(log: AdminAuditLog): string {
  const actor =
    log.actorDisplayName ??
    (log.actorType === "cloudflare_operator"
      ? "Cloudflare運用者"
      : "削除済み管理者")
  const target = log.targetDisplayName ?? "対象なし"
  return `${actor} → ${target}`
}

export function AuditLogList({ logs }: { logs: AdminAuditLog[] }) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium">監査ログ</h3>
      <ol className="divide-y rounded-lg border bg-background px-4">
        {logs.map((log) => {
          const reason =
            typeof log.details?.reason === "string" ? log.details.reason : null
          return (
            <li key={log.id} className="space-y-1 py-3 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{log.action}</span>
                <time className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("ja-JP")}
                </time>
              </div>
              <p>{auditSummary(log)}</p>
              {reason && (
                <p className="text-muted-foreground">理由: {reason}</p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
