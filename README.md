# shift-app

旭祭実行委員会向けのシフト管理アプリです。シフト提出・割り当て、勤怠、連絡・チャットを、モバイルファーストの PWA として提供します。

現在は基盤構築中です。TanStack Router、TanStack Query の IndexedDB 永続化、PWA、Hono/Cloudflare Workers、D1/Drizzle、Workers Static Assets による同一 origin 配信に加え、Discord OAuth、所属確認、onboarding の認証基盤まで実装済みです。

本番は `shift.kazui.dev` へ deploy 済みで、D1 migration、Discord application の資格情報、初回 `system_admin` の監査ログ付き昇格まで完了しています。未所属 Discord アカウントを拒否し、アプリ側にユーザーやセッションを作成しないことも本番で確認済みです。

管理者向けの member・role・session・identity recovery 管理と、その API 認可も実装済みです。次の実装対象は、年度・activity・希望提出・シフト割り当て・本人用タイムラインからなるシフト管理の最小版です。Notion OAuth は将来拡張、チャットは未実装です。GitHub からの自動 deploy は、Cloudflare Builds の設定と実 deploy の確認が完了するまで運用経路として扱いません。

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
