# shift-app

旭祭実行委員会向けのシフト管理アプリです。

シフト提出・管理、勤怠管理、チャット、PWA によるオフライン対応を扱います。

## Repository

```txt
/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── ui/
│   ├── db/
│   ├── auth/
│   └── shared/
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

## Docs

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Database](docs/database.md)
- [Development](docs/development.md)

## Commands

ルートで実行します。

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

API だけ確認する場合は `apps/api` 配下で実行します。

```bash
pnpm dev
```
