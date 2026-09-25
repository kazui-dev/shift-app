# Contributing

## 作業の流れ

1. `docs/architecture.md` で所有者と依存方向、`docs/conventions.md` で実装判断を確認する。重要な設計変更は `docs/adr/` へ決定と理由を残す。
2. `develop` から作業ブランチを作る。`main` は本番の安定版、`develop` は統合先とする。
3. 変更する機能の近くに実装とテストを置き、公開 API・保存形式・利用中の旧画面に影響する場合は `docs/compatibility.md` を更新する。
4. `vp check`、`vp exec knip`、`vp run -r --cache test` を実行する。スキーマや純粋ロジックでは `vp run -r coverage`、Web では `vp run web#build` も実行する。
5. PR は `develop` に向け、レビューと CI の後に squash merge する。`develop` から `main` は merge commit で反映する。本番 D1 migration は対応コードの deploy 前に別途確認・適用する。

現在の `refactor/repository-architecture` は、`develop` を導入した時点の同じ commit から開始した移行作業ブランチ。

## 名前

Issue があれば `type/<issue番号>-<短い説明>`、なければ `type/<短い説明>` とする。`type` は `feat`、`fix`、`refactor`、`perf`、`docs`、`test`、`build`、`ci`、`style`、`revert`、`chore` から選ぶ。commit と PR の題名は `type(scope): 日本語の説明`、72 文字以内にする。既存ブランチの改名はこのルールの導入条件にしない。

## ローカル作業

必要な環境と初期設定は [docs/setup.md](docs/setup.md) にまとめる。開発サーバーは `vp dev`。対象 workspace のコマンドは `vp -C apps/web ...`、`vp -C apps/api ...` の形で実行する。

共有 UI の追加は `vp -C apps/web exec shadcn add <component>`。CLI が `components.json` を読み、`packages/ui` とアプリ固有ファイルを配置する。registry 由来のコンポーネントは公開 export を保つ。

Worker binding や compatibility date を変更したら `vp -C apps/api run cf-typegen` で型を再生成する。DB 定義を変更したら `vp -C apps/api exec drizzle-kit generate` で SQL を生成し、差分をレビューして `vp -C apps/api exec wrangler d1 migrations apply shift-app --local` で確認する。remote への適用と deploy は明示指示を受けてから行う。

Vite+、Vite alias、Vitest、Cloudflare Vite plugin は連動して更新する。`pnpm-workspace.yaml` の alias と `vite-plus` の版、Vitest と coverage の版を揃え、CI の preview と dry-run deploy まで確認する。lockfile は pnpm のまま管理する。
