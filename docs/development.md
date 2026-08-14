# Development

## Principles

- 実装場所は責務で分ける
- 共有コードは責務に応じて `packages/*` に置く
- UI コンポーネントは `packages/ui` に集約する
- workspace 固有の操作は対象 directory で実行するか、ルートから `pnpm -C <directory>` を使う

## Where To Work

| Area                           | Directory         |
| ------------------------------ | ----------------- |
| Frontend                       | `apps/web`        |
| API                            | `apps/api`        |
| UI components                  | `packages/ui`     |
| DB schema / Drizzle            | `packages/db`     |
| Auth config（予定）            | `packages/auth`   |
| Shared schemas / types（予定） | `packages/shared` |

## UI Components

shadcn/ui のコンポーネント追加は `apps/web` で実行する。CLI が両方の `components.json` を読み、共有 UI は `packages/ui`、app 固有の block は `apps/web` に配置する。

```bash
cd apps/web
pnpm dlx shadcn@latest add button
```

アプリからは `@workspace/ui` 経由で import する。

```tsx
import { Button } from "@workspace/ui/components/button"
```

## API Bindings

`apps/api/wrangler.jsonc` の binding、`compatibility_date`、compatibility flag を変更したら型を再生成し、`worker-configuration.d.ts` も commit する。

```bash
pnpm run cf-typegen
```

Hono では `CloudflareBindings` を使う。

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

secret の値は `wrangler.jsonc` に書かない。local は git 管理外の `.dev.vars`、remote は `wrangler secret put` を使う。

## Database

schema 変更後は migration を生成し、SQL の差分を review して local D1 に適用する。

```bash
pnpm -C apps/api exec drizzle-kit generate
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --local
```

## Verification

ルートで実行する。

```bash
pnpm typecheck
pnpm lint
pnpm build
```

個別 app を確認する場合:

```bash
pnpm -C apps/web dev
pnpm -C apps/api dev
```

## Documentation

- 仕様は `docs/requirements.md`
- 技術方針は `docs/architecture.md`
- セットアップは `docs/setup.md`
- DB は `docs/database.md`
- 開発ルールは `docs/development.md`

ドキュメントのファイル名は英語にする。
