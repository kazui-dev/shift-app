# shift-app

旭祭実行委員会向けのシフト管理 PWA。希望提出、シフト割当、勤怠、連絡・チャットを提供します。React SPA と Hono Worker を Vite+ と Cloudflare Vite plugin で構築し、D1 と Durable Objects を使います。

## Repository

- `apps/web`: 画面、routing、機能別 UI と Web API client
- `apps/api`: HTTP API、認証、業務処理、Durable Objects
- `packages/shared`: Web と API の Valibot 契約、共有ロジック
- `packages/db`: Drizzle table 定義
- `packages/ui`: 共有 UI とデザイントークン

構成と依存方向は [Architecture](docs/architecture.md)、実装判断は [Conventions](docs/conventions.md) を参照してください。

## 開発

[Setup](docs/setup.md) で環境を用意し、`vp dev` で起動します。変更とブランチの手順は [Contributing](CONTRIBUTING.md) にまとめています。

## Docs

[ドキュメント案内](docs/README.md) を参照してください。本番の旧画面と共存する変更は [互換と変更の出し方](docs/compatibility.md) で管理します。
