# Architecture

## Goals

- フロントエンドとバックエンドを分けて保守しやすくする
- Cloudflare Workers / D1 / Durable Objects を前提に、低コストで運用する
- 型安全にフロントエンドとバックエンドをつなぐ
- モバイルファーストの SPA として作る

## Current Workspaces

```txt
apps/
├── web/
└── api/

packages/
├── ui/
├── db/
├── auth/
└── shared/
```

## Frontend

`apps/web` は React + Vite の SPA。

使うもの:

- React
- Vite
- TanStack Router
- TanStack Query
- shadcn/ui
- vite-plugin-pwa
- Zod

方針:

- ルーティングは TanStack Router を使う
- サーバー状態は TanStack Query で管理する
- API 入出力の検証には Zod を使う
- UI コンポーネントは `packages/ui` に集約する
- PWA は `apps/web` に導入する

## Backend

`apps/api` は Hono + Cloudflare Workers の API。

使うもの:

- Hono
- Cloudflare Workers
- Cloudflare D1
- Durable Objects
- Drizzle
- Better Auth
- Zod

方針:

- HTTP API は Hono で実装する
- 永続化は D1 を使う
- DB schema と query は Drizzle で管理する
- チャットやリアルタイム同期は Durable Objects を使う
- 認証は Better Auth を使う
- Workers bindings の型は `pnpm run cf-typegen` で生成する

## Packages

### `packages/ui`

shadcn/ui の共有 UI コンポーネントを置く。

### `packages/db`

Drizzle schema、DB client、migration 設定を置く。

### `packages/auth`

Better Auth の設定と handler を置く。

### `packages/shared`

フロントエンドとバックエンドの両方で使う型、Zod schema、定数を置く。

## Cloudflare Bindings

`apps/api/wrangler.jsonc` に Cloudflare resources を設定する。

- D1 binding
- Durable Objects binding
- Durable Objects migration
- vars
- secrets

bindings を変更したら `apps/api` 配下で実行する。

```bash
pnpm run cf-typegen
```

Hono では `CloudflareBindings` を使って `c.env` に型を付ける。

```ts
import { Hono } from "hono"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>()
  return c.json({ ok: row?.ok === 1 })
})

export default app
```
