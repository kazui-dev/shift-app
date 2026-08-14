# shift-app

旭祭実行委員会向けのシフト管理アプリです。シフト提出・割り当て、勤怠、連絡・チャットを、モバイルファーストの PWA として提供します。

現在は基盤構築中です。TanStack Router、TanStack Query の IndexedDB 永続化、PWA、Hono/Cloudflare Workers、D1/Drizzle、Workers Static Assets による同一 origin 配信に加え、Discord OAuth と onboarding の認証基盤まで実装済みです。Discord application の資格情報、本番 D1 migration、初回 `system_admin` 昇格、本番 deploy は未設定です。Notion OAuth は将来拡張、シフト管理とチャットは未実装です。

## Repository

```txt
apps/
├── web/       # React + Vite
└── api/       # Hono + Cloudflare Workers

packages/
├── ui/        # shadcn/ui の共有コンポーネント
├── db/        # Better Auth を含む Drizzle schema
└── shared/    # API schema、共有型、正規化処理
```

Worker binding に依存する Better Auth 設定は `apps/api/src/auth` に置きます。

## Setup

必要な Node.js バージョンと初期化手順は [docs/setup.md](docs/setup.md) を参照してください。

```bash
pnpm install
pnpm -C apps/api run cf-typegen
pnpm -C apps/api exec wrangler d1 migrations apply shift-app --local
# apps/api/.dev.vars.example を apps/api/.dev.vars にコピーして値を設定
pnpm dev
```

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Docs

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Database](docs/database.md)
- [Development](docs/development.md)
