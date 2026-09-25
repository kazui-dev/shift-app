# Shift App 作業指示

このリポジトリは pnpm monorepo のシフト管理 PWA。Web と Hono API を Vite+ と Cloudflare Vite plugin で構築し、Workers、D1、Durable Objects で運用する。

作業を始める前に、構成と依存方向は [docs/architecture.md](docs/architecture.md)、実装判断は [docs/conventions.md](docs/conventions.md)、手順とブランチ運用は [CONTRIBUTING.md](CONTRIBUTING.md) を確認する。重要な決定の理由は `docs/adr/`、本番クライアントとの互換は `docs/compatibility.md` に記録する。文書と実装が食い違う場合は調べてから両方を揃える。

- 変更は機能の所有者に置き、共有コードから機能固有コードを参照しない。境界入力は Web と API のそれぞれで検証し、認証・認可は必ず API で行う。
- ツールの入口は `vp`、workspace と lockfile は pnpm。生成物の `apps/api/worker-configuration.d.ts` と `apps/web/src/routeTree.gen.ts` は直接編集しない。
- 既存の TypeScript strict 設定を保つ。`any`、非 null アサーション、抑制コメント、未検証の cast で境界を通さない。
- 無関係な作業ツリーの変更を保持する。**commit、push、PR・Issue の作成、merge、deploy、remote resource の変更、remote D1 migration は、利用者の明示指示がある場合だけ行う。** 許可を受けた操作を繰り返し確認する必要はない。
- 変更の確認には `.agents/skills/verify-change/SKILL.md` を使う。Worker 設定、binding、Durable Object、D1 migration、preview、deploy の変更には `.agents/skills/change-cloudflare/SKILL.md` も使う。

レビューでは依存方向、未検証の入力、UI だけの認可、生成物の手編集、migration 漏れ、`docs/compatibility.md` にない暫定互換、重複した設定と不要な依存を確認する。
