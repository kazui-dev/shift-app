# 実装規約

## 配置と依存

機能に固有の UI、API 呼び出し、query、状態、純粋ロジックはその機能の `features/<name>` に置く。ファイルは変更理由と責務で分ける。抽象化や `service` 層を形だけで増やさず、複数の機能が本当に共有するときだけ共通領域へ上げる。名前は画面上の概念と業務上の概念に合わせ、短く具体的にする。

Web の `routes` は URL、loader、画面の構成を担当する。`app` は起動、認証済みレイアウト、共通 cache と接続のライフサイクルを担当し、機能を組み立てる。`components` と `lib` は機能に依存しないコードだけを担当する。`packages/ui` は再利用可能な shadcn/ui とデザイントークンを担当する。汎用の `components` と `lib`、共有 package から `features` を import しない。機能間の利用は参照先の責務が明確な module に限り、循環を作らない。画面の組み立ては route、`app`、管理画面などの上位機能で行い、複数機能に共通する契約は共有パッケージへ置く。

API の `routes` は HTTP と認可の構成、`domain` は純粋な判断、`services` は外部 I/O、`durable-objects` は状態を持つ調整を担当する。これらは機能ごとに近くへ置く。機能間で共有する認可は `apps/api/src/auth/authorization` に置き、認証方式に固有の実装は機能側に置いて `auth/index.ts` で組み立てる。複数機能の制限を URL に適用する middleware は `apps/api/src/routes` が所有し、`lib` は機能に依存しない HTTP 境界を担当する。DB 定義は `packages/db/src/schema`、Web/API 間の Valibot 契約は `packages/shared/src/contracts` に置く。DB 定義を HTTP 契約として流用しない。

## 境界と振る舞い

- Web の component は直接 `fetch` せず、各機能の API module を使う。HTTP 応答は共有 Valibot 契約で検証する。
- API は入力を使う前に検証する。認証、認可、同一 origin の制約はサーバーで強制し、画面の表示条件に依存しない。
- API の失敗は `apps/api/src/lib/errors.ts` の catalog を使う。Web の cache key は `apps/web/src/app/data/keys.ts` で組み立て、画面に文字列を直書きしない。
- API route は複数形の resource 名を使う。canonical な子 collection だけを親に入れ、本人固有のものは `/me` に置く。置換可能な単一 resource は `PUT`、部分的な状態変更は `PATCH` を使う。
- 入力境界では unknown を狭める。`any`、非 null アサーション、抑制コメント、検証していない cast に逃げない。
- registry から導入した shadcn/ui の public export を保ち、上流の形に必要な狭い lint 抑制は許容する。

## ツールと生成物

Oxc の lint・format 設定はルートの `vite.config.ts` に置く。別の Oxc 設定を増やさず、Bun、npm、Turborepo、ESLint、Prettier を並行導入しない。Worker の現在の compatibility date が必要な Node.js 互換動作を提供するため、`nodejs_compat` は追加しない。

## テストと互換

変更した振る舞いと境界の意味をテストする。同じ振る舞いを重複して確認せず、純粋な domain logic の statement、branch、function、line coverage は 100% を保つ。API テストは `apps/api/test/{unit,http,storage}`、共有 fixture は `apps/api/test/support` に置く。

本番には旧画面を開いた利用者がいる。出荷前に `docs/compatibility.md` の区分を確認し、一時的に残す互換をそこへ記録する。保存済みデータ、HTTP、WebSocket、Durable Object の識別子を変える場合は移行と戻し方を明確にする。
