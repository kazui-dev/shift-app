# shift-app

旭祭実行委員会向けのシフト管理アプリです。シフト提出・割り当て、勤怠、連絡・チャットを、モバイルファーストの PWA として提供します。

現在は基盤構築中です。TanStack Router、TanStack Query の IndexedDB 永続化、PWA、Hono/Cloudflare Workers、D1/Drizzle、Workers Static Assets による同一 origin 配信に加え、Discord OAuth、所属確認、onboarding の認証基盤まで実装済みです。

本番は `shift.kazui.dev` へ deploy 済みで、D1 migration、Discord application の資格情報、初回 `system_admin` の監査ログ付き昇格まで完了しています。未所属 Discord アカウントを拒否し、アプリ側にユーザーやセッションを作成しないことも本番で確認済みです。

管理者向けの member・年度参加者・role・session・identity recovery 管理に加え、年度・年度別権限・希望提出・activity・シフト割当・本人用タイムライン・勤務時間内の出勤記録・遅刻欠勤連絡・年度別の事務連絡・リアルタイムチャット・割当時と10分前のWeb Pushを実装済みです。これらは動作確認用の最小UIから操作できます。チャット送信はオフライン時に永続化して再開します。Notion OAuth は将来拡張です。GitHub からの自動 deploy は Cloudflare Builds で動作確認済みです。

## Architecture at a Glance

pnpm workspace を土台に、Vite+を開発toolchainの単一entry pointとして使います。Vite+配下のVite/Rolldown、Vitest、Oxlint、Oxfmt、task runnerを個別toolとして重複設定せず、rootの`vite.config.ts`から一括管理します。TypeScript 7、Knip、Cloudflare Vite Pluginはその外側で連携します。

```txt
pnpm monorepo
└── Vite+ unified toolchain
    ├── apps/web: React SPA
    ├── apps/api: Hono Worker
    └── Cloudflare Vite Plugin
        ├── Workers Static Assets
        ├── D1
        └── Durable Objects
```

WebはTanStack Router/Query、shadcn/ui、Valibot、PWAを使います。HTTP通信とresponse検証は`apps/web/src/api`に集約し、複雑なformだけReact Hook Formを使います。

APIはHono、Better Auth、Drizzle/D1、Durable Objects、Web Pushで構成します。`routes`がHTTP、`domain`が純粋logic、`services`が外部I/O、`durable-objects`がstateful coordinationを所有します。認証・認可・same-origin・Valibot検証はWorker境界で強制します。

Hono RPC clientは使わず、`packages/shared`のValibot schemaをWebとAPIの実行時契約にします。`nodejs_compat`は指定せず、現在のcompatibility dateによる既定動作を利用します。

## Repository

```txt
apps/
├── web/       # React SPA、routing、feature UI、API client
└── api/       # Hono + Cloudflare Workers

packages/
├── ui/        # shadcn/ui の共有コンポーネント
├── db/        # Better Auth を含むDrizzle schema
└── shared/    # Valibot API schema、共有型、純粋logic
```

Worker binding に依存する Better Auth 設定は `apps/api/src/auth` に置きます。

## Setup

必要な Node.js バージョンと初期化手順は [docs/setup.md](docs/setup.md) を参照してください。

```bash
vp install
vp -C apps/api run cf-typegen
vp -C apps/api exec wrangler d1 migrations apply shift-app --local
# apps/api/.dev.vars.example を apps/api/.dev.vars にコピーして値を設定
vp dev
```

## Verification

```bash
vp check
vp exec knip
vp run -r --cache test
vp run -r coverage
vp run web#build
```

## Docs

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Database](docs/database.md)
- [Development](docs/development.md)
