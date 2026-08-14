# shift-app

旭祭実行委員会向けのシフト管理アプリです。シフト提出・割り当て、勤怠、連絡・チャットを、モバイルファーストの PWA として提供します。

現在は基盤構築中です。TanStack Router、TanStack Query の IndexedDB 永続化、PWA、Hono/Cloudflare Workers、D1/Drizzle、Workers Static Assets による同一 origin 配信まで構成済みです。認証、シフト管理、チャットは未実装です。

## Repository

```txt
apps/
├── web/       # React + Vite
└── api/       # Hono + Cloudflare Workers

packages/
├── ui/        # shadcn/ui の共有コンポーネント
└── db/        # Drizzle schema
```

今後 `packages/auth` と `packages/shared` を追加する予定です。

## Setup

必要な Node.js バージョンと初期化手順は [docs/setup.md](docs/setup.md) を参照してください。

```bash
pnpm install
pnpm -C apps/api run cf-typegen
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --local
pnpm dev
```

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Docs

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Database](docs/database.md)
- [Development](docs/development.md)
