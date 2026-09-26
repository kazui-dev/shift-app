# API

Cloudflare Worker 上の Hono API。`src/index.ts` が Worker の fetch・scheduled・Durable Object export、`src/app.ts` が認証と API の入口を組み立てる。

公開 URL の組み立ては `src/routes`、機能固有の HTTP handler・純粋ロジック・外部 I/O・Durable Object は `src/features/<name>` に置く。共通の認証・認可は `src/auth`、HTTP 境界とエラーは `src/lib`、テストは `test/{unit,http,storage}` に置く。詳細な依存方向は [アーキテクチャ](../../docs/architecture.md) と [実装規約](../../docs/conventions.md) を参照。

環境の準備は [セットアップ](../../docs/setup.md)、検証・migration・ブランチの手順は [Contributing](../../CONTRIBUTING.md) にまとめる。
