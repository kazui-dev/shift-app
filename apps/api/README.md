# API

Hono を Cloudflare Workers 上で動かす API workspace です。共通の初期化手順は [../../docs/setup.md](../../docs/setup.md) を参照してください。

`src/index.ts` はCloudflare Workerのentry point、`src/app.ts`はHono applicationの合成だけを担当します。HTTP handlerは`src/routes`へresource単位で置き、年度配下のresourceと管理APIのquery/commandも個別moduleに分けます。純粋logicは`src/domain`、外部I/Oは`src/services`、Durable Objectは`src/durable-objects`に置き、testはruntime sourceと分けて`test/unit`に置きます。

リポジトリのルートから実行する例:

```bash
vp -C apps/api run cf-typegen
vp -C apps/api exec wrangler d1 migrations apply shift-app --local
vp -C apps/api run dev
```

remote deploy と migration は Cloudflare へ login し、生成 SQL と対象 database を確認してから実行します。

```bash
vp -C apps/api exec wrangler d1 migrations apply shift-app --remote
vp run deploy
```

`wrangler.jsonc` を変更したら `cf-typegen` を再実行し、Hono の binding 型には生成された `CloudflareBindings` を使います。

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
