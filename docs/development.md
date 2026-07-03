# Development

## Principles

- 実装場所は責務で分ける
- 共有コードは責務に応じて `packages/*` に置く
- UI コンポーネントは `packages/ui` に集約する
- workspace をまたぐ操作は、基本的に対象ディレクトリへ移動して実行する

## Where To Work

| Area | Directory |
| --- | --- |
| Frontend | `apps/web` |
| API | `apps/api` |
| UI components | `packages/ui` |
| DB schema / Drizzle | `packages/db` |
| Auth config | `packages/auth` |
| Shared schemas / types | `packages/shared` |

## UI Components

shadcn/ui のコンポーネント追加はルートで実行する。

```bash
pnpm dlx shadcn@latest add button -c packages/ui
```

アプリからは `@workspace/ui` 経由で import する。

```tsx
import { Button } from "@workspace/ui/components/button"
```

## API Bindings

`apps/api/wrangler.jsonc` の bindings を変更したら、`apps/api` 配下で型を再生成する。

```bash
pnpm run cf-typegen
```

Hono では `CloudflareBindings` を使う。

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## Verification

ルートで実行する。

```bash
pnpm typecheck
pnpm lint
pnpm build
```

個別アプリを確認する場合は、それぞれの app 配下で実行する。

```bash
pnpm dev
```

## Documentation

- 仕様は `docs/requirements.md`
- 技術方針は `docs/architecture.md`
- セットアップは `docs/setup.md`
- DB は `docs/database.md`
- 開発ルールは `docs/development.md`

ドキュメントのファイル名は英語にする。
