# Setup

この文書は、作成済みリポジトリを開発できる状態にする手順を扱う。scaffold 時のコマンドは再実行しない。

## Requirements

- Node.js 20.19 以上、または 22.12 以上（Vite 8 の要件）。LTS を推奨
- pnpm 10.33.4（ルート `package.json` の `packageManager` を正とする）
- remote resource を作成・変更する場合のみ Cloudflare account

Corepack を使う場合:

```bash
corepack enable
node -v
pnpm -v
```

## Install

リポジトリのルートで実行する。

```bash
pnpm install
pnpm -C apps/api run cf-typegen
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --local
```

`cf-typegen` は `wrangler.jsonc` の binding、compatibility date、compatibility flag に対応する `worker-configuration.d.ts` を生成する。設定変更後も再実行する。

## Local Development

全 workspace の開発 server:

```bash
pnpm dev
```

個別に起動する場合:

```bash
pnpm -C apps/web dev
pnpm -C apps/api dev
```

local D1 は Wrangler の local state を使う。remote D1 を通常の開発で共有すると、誤更新や開発者間の干渉が起きるため避ける。

## Database Migrations

Drizzle schema は `packages/db/src/schema.ts`、生成設定は `apps/api/drizzle.config.ts`、SQL migration は `apps/api/migrations` に置く。

schema を変更したら次を実行する。

```bash
pnpm -C apps/api exec drizzle-kit generate
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --local
```

生成された SQL を review し、local で検証してから remote に適用する。

```bash
pnpm -C apps/api exec wrangler login
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --remote
```

database 名 `shift-app` を指定しているのは、binding 名が将来変わっても別 DB へ誤適用しにくくするため。新しい D1 database を作る場合だけ `wrangler d1 create` を使い、返された `database_id` を `apps/api/wrangler.jsonc` に設定する。

## Secrets

local secret は git 管理しない `apps/api/.dev.vars` に置く。remote secret は値をコマンドライン引数へ埋め込まず、対話入力する。

```bash
pnpm -C apps/api exec wrangler secret put BETTER_AUTH_SECRET
pnpm -C apps/api exec wrangler secret put DISCORD_CLIENT_SECRET
pnpm -C apps/api exec wrangler secret put NOTION_CLIENT_SECRET
```

client ID のような公開可能な設定は `vars`、client secret と署名鍵は secret として扱う。

## Frontend Configuration

### TanStack Router

ファイルベース routing を構成済み。`apps/web/vite.config.ts` では `tanstackRouter()` を `react()` より前に登録し、route は `src/routes`、生成 tree は `src/routeTree.gen.ts` に置く。

### shadcn/ui

両 workspace の `components.json` は設定済み。共有 component や block の追加は `apps/web` から実行し、CLI に `packages/ui` と app 固有ファイルの配置を判断させる。

```bash
cd apps/web
pnpm dlx shadcn@latest add button
```

### PWA / TanStack Query

Vite PWA plugin が Service Worker と manifest を生成する。TanStack Query cache は IndexedDB に保存する。Service Worker、query cache、mutation queue は別の責務として扱い、mutation queue は各機能の API を実装するときに追加する。

## Planned Integrations

### Durable Objects

実装時は `apps/api/src` から class を export し、`wrangler.jsonc` に `durable_objects.bindings` と SQLite storage の宣言型 `exports` を追加する。古い `new_classes` migration は新規 namespace に使わない。設定後に `cf-typegen` を再実行する。

### Better Auth

Discord と Notion は Better Auth の組み込み social provider を使える。OAuth 成功だけを所属確認とみなさず、許可する Discord server / Notion workspace の識別子をサーバー側で検証する。認証 schema と migration は Better Auth の採用バージョンを固定してから生成する。

## Verification

ルートで実行する。

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Worker bundle と Static Assets の設定を Cloudflare へ送信せず検証する:

```bash
pnpm -C apps/api exec wrangler deploy --dry-run
pnpm -C apps/api exec wrangler check startup
```

本番 D1 migration を適用済みであることを確認してから、Web と API を同じ Worker へ deploy する:

```bash
pnpm deploy
```
