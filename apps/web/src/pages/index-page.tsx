import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@workspace/ui/components/button"

const healthSchema = z.object({
  ok: z.literal(true),
  database: z.literal("ready"),
  members: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
})

async function getHealth() {
  const response = await fetch("/api/health")
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }

  return healthSchema.parse(await response.json())
}

export function IndexPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  })

  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center p-6">
      <div className="flex min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <p className="text-muted-foreground">旭祭実行委員会</p>
          <h1 className="text-xl font-medium">シフト管理アプリ</h1>
          <p className="mt-2 text-muted-foreground">
            ルーティング、オフラインキャッシュ、API と D1 の基盤を準備しました。
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="font-medium">環境ステータス</p>
          {health.isPending && <p>API を確認しています…</p>}
          {health.isError && (
            <div className="space-y-2">
              <p className="text-destructive">API に接続できません。</p>
              <Button size="sm" onClick={() => health.refetch()}>
                再試行
              </Button>
            </div>
          )}
          {health.data && (
            <p className="text-muted-foreground">
              API / D1: 正常（members: {health.data.members}）
            </p>
          )}
        </div>

        <p className="font-mono text-xs text-muted-foreground">
          d キーでダークモードを切り替えられます。
        </p>
      </div>
    </main>
  )
}
