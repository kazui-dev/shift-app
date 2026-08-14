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

OAuth を動かす場合は `apps/api/.dev.vars.example` を `apps/api/.dev.vars` にコピーし、後述の 3 つの認証用設定値を設定する。`.dev.vars` は commit しない。

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

生成された SQL を review し、local で検証してから remote に適用する。現在の `0001` は placeholder の `members` table を作り直すため、本番適用前に remote の件数が 0 件であることを必ず確認する。

```bash
pnpm -C apps/api exec wrangler login
pnpm -C apps/api exec wrangler d1 execute shift-app --remote --command "SELECT COUNT(*) AS member_count FROM members"
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --remote
```

database 名 `shift-app` を指定しているのは、binding 名が将来変わっても別 DB へ誤適用しにくくするため。新しい D1 database を作る場合だけ `wrangler d1 create` を使い、返された `database_id` を `apps/api/wrangler.jsonc` に設定する。

## Secrets

local secret は git 管理しない `apps/api/.dev.vars` に置く。remote secret は値をコマンドライン引数へ埋め込まず、対話入力する。

```bash
pnpm -C apps/api exec wrangler secret put BETTER_AUTH_SECRET
pnpm -C apps/api exec wrangler secret put DISCORD_CLIENT_ID
pnpm -C apps/api exec wrangler secret put DISCORD_CLIENT_SECRET
```

client ID 自体は機密情報ではない。ただしこの構成では環境ごとの必須値をリポジトリへ固定しないため、Cloudflare の secret binding 経由で注入する。server ID と公開 URL は `wrangler.jsonc` の `vars`、client secret と署名鍵は必ず secret として扱う。

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

## Integrations

### Durable Objects

実装時は `apps/api/src` から class を export し、`wrangler.jsonc` に `durable_objects.bindings` と SQLite storage の宣言型 `exports` を追加する。古い `new_classes` migration は新規 namespace に使わない。設定後に `cf-typegen` を再実行する。

### Better Auth（実装済み、資格情報未設定）

Better Auth 1.6.29 に固定し、Discord の組み込み social provider を拡張して所属確認を行う。認証 schema、onboarding、所属確認のテストを実装済み。Discord application の作成と資格情報の注入後に実ブラウザで callback を確認する。

初期版の OAuth callback URL:

```text
http://localhost:5173/api/auth/callback/discord
https://shift.kazui.dev/api/auth/callback/discord
```

Vite の local port が変わる場合は provider 側の redirect URL も合わせる。

Discord は bot を server へ追加せず、OAuth した本人の `identify` と `guilds.members.read` scope で対象 server の member 情報を取得する。email scope は要求しない。そのため server 管理者権限は不要。Discord Developer Portal で application を作成できればよい。

`wrangler.jsonc` の非 secret 設定:

```text
BETTER_AUTH_URL=https://shift.kazui.dev
DISCORD_GUILD_ID=1047724512873041941
```

環境 binding として注入する値:

```text
BETTER_AUTH_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
```

OAuth profile、email、学籍番号の一致で account を暗黙連携しない。管理者承認による recovery だけを許可する。詳細な flow は `docs/requirements.md`、table 設計は `docs/database.md` を参照する。

Notion OAuth は将来拡張であり、現時点では設定不要。候補 workspace ID と検討事項は `docs/requirements.md` に残す。

## Verification

ルートで実行する。

```bash
pnpm typecheck
pnpm lint
pnpm test
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
