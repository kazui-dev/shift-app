# Development

## Principles

- 実装場所は責務で分ける
- 共有コードは責務に応じて `packages/*` に置く
- UI コンポーネントは `packages/ui` に集約する
- workspace 固有の操作は対象 directory で実行するか、ルートから `vp -C <directory>` を使う

## Where To Work

| Area                          | Directory           |
| ----------------------------- | ------------------- |
| Frontend                      | `apps/web`          |
| API                           | `apps/api`          |
| UI components                 | `packages/ui`       |
| DB schema / Drizzle           | `packages/db`       |
| Auth config / provider checks | `apps/api/src/auth` |
| Shared schemas / types        | `packages/shared`   |

## UI Components

shadcn/ui のコンポーネント追加は `apps/web` で実行する。CLI が両方の `components.json` を読み、共有 UI は `packages/ui`、app 固有の block は `apps/web` に配置する。

```bash
vp -C apps/web exec shadcn add button
```

アプリからは `@workspace/ui` 経由で import する。

```tsx
import { Button } from "@workspace/ui/components/button"
```

## API Bindings

`apps/api/wrangler.jsonc` の binding、`compatibility_date`、compatibility flag を変更したら型を再生成し、`worker-configuration.d.ts` も commit する。

```bash
vp run cf-typegen
```

Hono では `CloudflareBindings` を使う。

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

secret の値は `wrangler.jsonc` に書かない。local は git 管理外の `.dev.vars`、remote は `wrangler secret put` を使う。

## Database

schema 変更後は migration を生成し、SQL の差分を review して local D1 に適用する。

```bash
vp -C apps/api exec drizzle-kit generate
vp -C apps/api exec wrangler d1 migrations apply shift-app --local
```

## Verification

ルートで実行する。

```bash
vp check
vp exec knip
vp run -r coverage
vp run -r --cache typecheck
vp run -r --cache test
vp run web#build
```

Vite+、Vite Core alias、Vitest、Cloudflareを含むVite plugin群は、
Dependabotの`vite-plus-toolchain` groupでまとめて更新する。更新PRでは上記の
静的検証とcoverageに加え、CIがCloudflare previewを起動して`/`のHTML 200と
`/api/me/timeline`のJSON 401を確認し、最後にdry-run deployまで通す。
Vite+更新時は`pnpm-workspace.yaml`の`vite` aliasと`vite-plus`を同じversionへ
更新する。peer許可versionはYAML anchorで`vite-plus`と常に同期する。

`voidzero-dev/setup-vp`はGitHub Actions側の`vite-plus-actions` groupで更新する。
package更新と同時期に更新された場合は、両方のPRを同じ検証結果が揃ってから
mergeする。

ローカル開発は Cloudflare Vite Plugin が frontend と Worker をまとめて起動する。

```bash
vp dev
```

## Documentation

- 仕様は `docs/requirements.md`
- 技術方針は `docs/architecture.md`
- セットアップは `docs/setup.md`
- DB は `docs/database.md`
- 開発ルールは `docs/development.md`

ドキュメントのファイル名は英語にする。
