# Architecture

## Goals

- モバイルファーストの SPA と API を責務ごとに保守できるようにする
- Cloudflare Workers と D1 を中心に、小規模運用から始められる構成にする
- API 境界と共有 schema で型安全性を保つ
- 通信断が起きても、閲覧と送信待ちが安全に継続できるようにする

## Status

| Area                          | Status                                  |
| ----------------------------- | --------------------------------------- |
| React / Vite / shadcn/ui      | 導入済み                                |
| D1 binding / Drizzle schema   | 初期構成済み                            |
| TanStack Router / Query       | routing と query cache 永続化を構成済み |
| PWA / offline persistence     | app shell と静的 asset cache を構成済み |
| Better Auth / OAuth           | handler・所属確認・onboarding 実装済み |
| Durable Objects / chat        | 未実装                                  |
| `packages/shared`             | 認証 schema・共有型を実装済み           |

ドキュメント内の「方針」「予定」は、現在の実装済み機能を意味しない。

## Frontend

`apps/web` は React + Vite の SPA とする。

- ファイルベースルーティングに TanStack Router を使う。Vite plugin は `@vitejs/plugin-react` より前に登録する。
- サーバー状態と optimistic update に TanStack Query を使う。
- UI 部品は shadcn/ui CLI で管理し、共有可能な部品を `packages/ui` に置く。
- API 入出力は Zod schema で検証し、共通 schema は `packages/shared` に置く。
- Service Worker の asset cache と、TanStack Query のデータ cache を別物として設計する。

Query cache は `PersistQueryClientProvider` と IndexedDB persister で 24 時間保持する。Service Worker の navigation fallback は `/api/*` を必ず除外し、OAuth callback と API response を app shell へ置き換えない。offline mutation の復元口は用意済みだが、実際の送信待ちは未実装。機能追加時に mutation key ごとの既定 `mutationFn`、競合、重複送信、期限切れデータの扱いを API 側と合わせて決める。

## Backend

`apps/api` は Hono を載せた Cloudflare Worker とする。

- HTTP API は Hono で実装する。
- 永続データは D1、schema と query は Drizzle で管理する。
- 認証と session 管理には Better Auth を使う。Discord OAuth identity と domain 上の `members` を分離し、許可対象 server をサーバー側で検証する。
- ルーム単位の WebSocket 接続、順序制御、presence など、単一の調整主体が必要なチャット機能に Durable Objects を使う。通常の CRUD は D1 に置く。
- 新規 Durable Object は SQLite storage を使い、class lifecycle は Wrangler の宣言型 `exports` で管理する。
- `nodejs_compat` は依存 package が Node.js API を必要とすると確認できた場合だけ有効にする。

D1 の read replication は初期要件ではない。必要になった場合は単に有効化するだけでなく、D1 binding の Sessions API と bookmark を使って read-after-write を維持する。

## Authentication Architecture

Better Auth の `user` は認証主体、`account` は Discord OAuth identity、`members` は利用可能なシフトアプリアカウントとして扱う。OAuth を完了しても `members` がない `user` は onboarding 中であり、通常 API へアクセスできない。

```mermaid
flowchart TD
    A["Discord で続ける"] --> B["OAuth callback"]
    B --> C{"許可 server か"}
    C -->|No| D["login 拒否"]
    C -->|Yes| E{"identity に member があるか"}
    E -->|Yes| F["通常 session でログイン"]
    E -->|No| G["制限付き session で onboarding"]
    G --> H{"学籍番号は未登録か"}
    H -->|Yes| I["member 作成・identity 連携"]
    H -->|No| J["作成せず追加連携または管理者申請へ"]
```

所属確認:

- Discord は組み込み provider の `getUserInfo` を拡張し、OAuth user token と `identify`、`guilds.members.read` scope を使って、server ID `1047724512873041941` に対する current user member endpoint を確認してから user info を返す。email scope は要求しない。
- 比較対象 ID は `vars`、OAuth client secret と Better Auth secret は secret binding に置く。OAuth access/refresh token を保存する場合は暗号化する。

Better Auth の通常の social sign-up は OAuth callback 中に `user` を作成する。これは domain 上のアカウント作成とはみなさず、`members` 作成前の認証主体として扱う。未完了 user は権限を持たず、期限切れの onboarding user は定期的に削除できる設計にする。

email や学籍番号の一致による暗黙 linking は無効にする。学籍番号衝突時の管理者申請は別 workflow とし、自動で Better Auth の `account.user_id` を付け替えない。Better Auth の account schema は、将来 Notion などを明示的 linking で追加できる形を維持する。

Notion OAuth は将来拡張とする。追加時は workspace ID `27865ff8-ac56-47e9-9aac-0ed6f3c4d0c5` を候補に、public connection の権限、通常 member が authorize できるか、Enterprise の connection 制限、recovery 方針を改めて確認する。現行 Worker は Notion の credential、binding、provider code を持たない。

## Cloudflare Deployment

Vite の生成物を API Worker の Workers Static Assets として同時に deploy する。`not_found_handling: "single-page-application"` で client routing を処理し、`assets.run_worker_first: ["/api/*"]` で API request だけ Hono を先に実行する。

Web と API を同一 origin にすることで CORS と認証 cookie の構成を単純にする。local は Vite が `/api` を Wrangler の port 8787 へ proxy する。Cloudflare Pages と Cloudflare Vite plugin は現在の構成では使わない。

## Packages

| Package                   | Responsibility                                             |
| ------------------------- | ---------------------------------------------------------- |
| `packages/ui`             | shadcn/ui の共有コンポーネントと global CSS                |
| `packages/db`             | Drizzle schema。DB client は Worker の D1 binding から作る |
| `apps/api/src/auth`       | D1 binding を使う Better Auth 設定、provider 所属確認      |
| `packages/shared`         | API schema、共有型、正規化処理                             |

## Cloudflare Bindings

resource binding と非機密の `vars` は `apps/api/wrangler.jsonc` に定義する。secret の値は設定ファイルへ書かず、local は `.dev.vars`、remote は `wrangler secret put` で管理する。

`wrangler.jsonc` の binding、`compatibility_date`、compatibility flag を変えたら、生成型を更新して commit する。

```bash
pnpm -C apps/api run cf-typegen
```

Hono では生成された `CloudflareBindings` を `c.env` の型に使う。

```ts
import { Hono } from "hono"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get("/health", async (c) => {
  const row = await c.env.shift_app
    .prepare("SELECT 1 AS ok")
    .first<{ ok: number }>()

  return c.json({ ok: row?.ok === 1 })
})

export default app
```

新規の `ChatRoom` class を同じ Worker から呼ぶ構成例:

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "CHAT_ROOMS", "class_name": "ChatRoom" }],
  },
  "exports": {
    "ChatRoom": { "type": "durable-object", "storage": "sqlite" },
  },
}
```

従来の `migrations` 配列と `exports` は併用しない。`exports` の deleted / renamed state はデータ破壊や namespace 変更を伴うため、deploy 前に必ず差分を確認する。

## References

2026-08-15 に確認した一次情報。仕様変更が多い項目は実装前にも再確認する。

- [Cloudflare: Durable Object class exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Cloudflare: Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare: D1 global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Cloudflare: TypeScript and `wrangler types`](https://developers.cloudflare.com/workers/languages/typescript/)
- [Better Auth: Discord](https://better-auth.com/docs/authentication/discord)
- [Better Auth: Account linking](https://better-auth.com/docs/concepts/users-accounts#account-linking)
- [Discord: OAuth2 scopes](https://docs.discord.com/developers/topics/oauth2#shared-resources-oauth2-scopes)
- [Discord: Get Current User Guild Member](https://docs.discord.com/developers/resources/user#get-current-user-guild-member)
- [TanStack Router: Manual setup](https://tanstack.com/router/latest/docs/installation/manual)
- [TanStack Query: Persisting a QueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- [shadcn/ui: Monorepo](https://ui.shadcn.com/docs/monorepo)
- [Vite 8: Getting started](https://v8.vite.dev/guide/)
