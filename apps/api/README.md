# API

Hono を Cloudflare Workers 上で動かす API workspace です。共通の初期化手順は [../../docs/setup.md](../../docs/setup.md) を参照してください。

リポジトリのルートから実行する例:

```bash
pnpm -C apps/api run cf-typegen
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --local
pnpm -C apps/api dev
```

remote deploy と migration は Cloudflare へ login し、生成 SQL と対象 database を確認してから実行します。

```bash
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --remote
pnpm -C apps/api run deploy
```

`wrangler.jsonc` を変更したら `cf-typegen` を再実行し、Hono の binding 型には生成された `CloudflareBindings` を使います。

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
