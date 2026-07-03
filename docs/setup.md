# Setup

## Requirements

- Node.js 20 以上
- pnpm
- Cloudflare アカウント

任意の作業ディレクトリで実行する。

```bash
corepack enable
corepack prepare pnpm@10.33.4 --activate
node -v
pnpm -v
```

## Create Repository

リポジトリを作成する親ディレクトリで実行する。

```bash
pnpm dlx shadcn@latest init --preset bIkeymG --template vite --monorepo --pointer
```

リポジトリ名を聞かれたら `shift-app` を入力する。

## Frontend

`apps/web` 配下で実行する。

```bash
pnpm add @tanstack/react-router @tanstack/react-query zod
pnpm add -D @tanstack/router-plugin vite-plugin-pwa
```

TanStack Router の設定は `apps/web/vite.config.ts` と `apps/web/src` 配下に追加する。

## UI

共有コンポーネントは `packages/ui` に置く。

アプリ側では `@workspace/ui` から import する。

```tsx
import { Button } from "@workspace/ui/components/button"
import "@workspace/ui/globals.css"
```

コンポーネントを追加する場合は、ルートで実行する。

```bash
pnpm dlx shadcn@latest add button -c packages/ui
```

## API

`apps` 配下で実行する。

```bash
pnpm create hono@latest api --template cloudflare-workers --pm pnpm --install
cd api
pnpm add zod
```

Workers の Binding 型を生成する。`apps/api` 配下で実行する。

```bash
pnpm run cf-typegen
```

`cf-typegen` は、生成された `apps/api/package.json` に入っている `wrangler types --env-interface CloudflareBindings` の script。

## Cloudflare Workers

生成された `apps/api/wrangler.jsonc` を編集する。

- `name` を `shift-app-api` にする
- Cloudflare resources を追加する
  - D1 binding
  - Durable Objects binding
  - Durable Objects migration
- Better Auth などで Node.js 互換 API が必要な場合は compatibility flags を追加する
- bindings を変更したら `apps/api` 配下で `pnpm run cf-typegen` を実行する

## D1 / Drizzle

DB パッケージを作成する。ルートで実行する。

```bash
mkdir -p packages/db/src
```

`packages/db/package.json` を作成する。

```json
{
  "name": "@workspace/db",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts"
  }
}
```

`packages/db` 配下で実行する。

```bash
pnpm add drizzle-orm
```

`apps/api` 配下で実行する。

```bash
pnpm add drizzle-orm "@workspace/db@workspace:*"
pnpm add -D drizzle-kit
```

D1 データベースを作成する。`apps/api` 配下で実行する。

```bash
pnpm wrangler d1 create shift-app
```

出力された `database_id` を `apps/api/wrangler.jsonc` に設定する。

migration を生成・適用する。`apps/api` 配下で実行する。

```bash
pnpm drizzle-kit generate
pnpm wrangler d1 migrations apply shift-app --local
```

remote に適用する場合は、local で確認してから実行する。

```bash
pnpm wrangler d1 migrations apply shift-app --remote
```

## Durable Objects

チャットやリアルタイム同期用に Durable Objects を API 側へ置く。

```txt
apps/api/src/
├── index.ts
└── durable-objects/
    └── chat-room.ts
```

`ChatRoom` class を export し、`wrangler.jsonc` の `durable_objects.bindings` と Durable Objects migration に登録する。

## Better Auth

Auth パッケージを作成する。ルートで実行する。

```bash
mkdir -p packages/auth/src
```

`packages/auth/package.json` を作成する。

```json
{
  "name": "@workspace/auth",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/auth` 配下で実行する。

```bash
pnpm add better-auth
```

`apps/api` 配下で実行する。

```bash
pnpm add "@workspace/auth@workspace:*"
```

Hono 側では `/api/auth/*` を Better Auth の handler に流す。

Discord OAuth / Notion OAuth を使う場合は、Cloudflare Workers の secrets として client id、client secret、secret key を管理する。

## Shared Package

フロントエンドとバックエンドで共有する型や Zod schema を置く。

ルートで実行する。

```bash
mkdir -p packages/shared/src/schema packages/shared/src/types
```

`packages/shared/package.json` を作成する。

```json
{
  "name": "@workspace/shared",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./schema/*": "./src/schema/*.ts",
    "./types/*": "./src/types/*.ts"
  }
}
```

`packages/shared` 配下で実行する。

```bash
pnpm add zod
```

`apps/web` 配下で実行する。

```bash
pnpm add "@workspace/shared@workspace:*"
```

`apps/api` 配下で実行する。

```bash
pnpm add "@workspace/shared@workspace:*"
```

## Verification

ルートで実行する。

```bash
pnpm typecheck
pnpm lint
pnpm build
```

アプリ全体の開発サーバーを起動する。ルートで実行する。

```bash
pnpm dev
```

Cloudflare Workers だけを確認する場合は、`apps/api` 配下で実行する。

```bash
pnpm dev
```
