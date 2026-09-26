# Setup

この文書は、作成済みリポジトリを開発できる状態にする手順を扱う。scaffold 時のコマンドは再実行しない。

## Requirements

- Node.js 22.23.1（ルート `.node-version` を正とする）
- Vite+ 0.2.9
- pnpm 10.33.4（Vite+がルート `package.json` の `packageManager` から解決する）
- remote resource を作成・変更する場合のみ Cloudflare account

Vite+をインストールしてversionを確認する:

```bash
curl -fsSL https://vite.plus | bash
vp toolchain
```

## Install

リポジトリのルートで実行する。

```bash
vp install
vp -C apps/api run cf-typegen
vp -C apps/api exec wrangler d1 migrations apply shift-app --local
```

OAuth を動かす場合は `apps/api/.dev.vars.example` を `apps/api/.dev.vars` にコピーし、後述の 3 つの認証用設定値を設定する。`.dev.vars` は commit しない。

`cf-typegen` は `wrangler.jsonc` の binding、compatibility date、compatibility flag に対応する `worker-configuration.d.ts` を生成する。設定変更後も再実行する。

## Local Development

全 workspace の開発 server:

```bash
vp dev
```

個別に起動する場合:

```bash
vp -C apps/web dev
vp -C apps/api run dev
```

local D1 は Wrangler の local state を使う。remote D1 を通常の開発で共有すると、誤更新や開発者間の干渉が起きるため避ける。

## Database Migrations

Drizzle schema は `packages/db/src/schema.ts`、生成設定は `apps/api/drizzle.config.ts`、SQL migration は `apps/api/migrations` に置く。

schema を変更したら次を実行する。

```bash
vp -C apps/api exec drizzle-kit generate
vp -C apps/api exec wrangler d1 migrations apply shift-app --local
```

生成された SQL を review し、local で検証してから remote に適用する。既存 migration は編集せず、新しい migration の SQL と本番データへの影響を確認する。

```bash
vp -C apps/api exec wrangler login
vp -C apps/api exec wrangler d1 execute shift-app --remote --command "SELECT COUNT(*) AS member_count FROM app_users"
vp -C apps/api exec wrangler d1 migrations apply shift-app --remote
```

database 名 `shift-app` を指定しているのは、binding 名が将来変わっても別 DB へ誤適用しにくくするため。新しい D1 database を作る場合だけ `wrangler d1 create` を使い、返された `database_id` を `apps/api/wrangler.jsonc` に設定する。

## Secrets

local secret は git 管理しない `apps/api/.dev.vars` に置く。remote secret は値をコマンドライン引数へ埋め込まず、対話入力する。

```bash
vp -C apps/api exec wrangler secret put BETTER_AUTH_SECRET
vp -C apps/api exec wrangler secret put DISCORD_CLIENT_ID
vp -C apps/api exec wrangler secret put DISCORD_CLIENT_SECRET
```

client ID 自体は機密情報ではない。ただしこの構成では環境ごとの必須値をリポジトリへ固定しないため、Cloudflare の secret binding 経由で注入する。server ID と公開 URL は `wrangler.jsonc` の `vars`、client secret と署名鍵は必ず secret として扱う。

## Frontend Configuration

### TanStack Router

ファイルベース routing を構成済み。`apps/web/vite.config.ts` では `tanstackRouter()` を `react()` より前に登録し、route は `src/routes`、生成 tree は `src/routeTree.gen.ts` に置く。

### shadcn/ui

両 workspace の `components.json` は設定済み。共有 component や block の追加は `apps/web` から実行し、CLI に `packages/ui` と app 固有ファイルの配置を判断させる。

```bash
vp -C apps/web exec shadcn add button
```

### PWA / TanStack Query

Vite PWA plugin が Service Worker と manifest を生成する。TanStack Query cache は IndexedDB に保存する。Service Worker、query cache、mutation queue は別の責務として扱い、mutation queue は各機能の API を実装するときに追加する。

## Integrations

### Durable Objects

`ChatRoom` と `ChatDirectory` class は `apps/api/src` から export し、`wrangler.jsonc` の `durable_objects.bindings` と SQLite storage の宣言型 `exports` で管理する。binding を変更したら `cf-typegen` を再実行する。

### Better Auth（実装済み）

Better Auth 1.6.29 に固定し、Discord の組み込み social provider を拡張して所属確認を行う。認証 schema、onboarding、所属確認のテストを実装済みで、local・本番ともに OAuth callback を確認済み。

初期版の OAuth callback URL:

```text
http://localhost:5173/api/auth/callback/discord
https://shift.kazui.dev/api/auth/callback/discord
```

Vite の local port が変わる場合は provider 側の redirect URL も合わせる。

Discord は bot を server へ追加せず、OAuth した本人の `identify` と `guilds.members.read` scope で対象 server の member 情報を取得する。email scope は要求しない。そのため server 管理者権限は不要。Discord Developer Portal で application を作成できればよい。

`wrangler.jsonc` の非 secret 設定:

```text
BETTER_AUTH_URL=https://shift.kazui.dev
DISCORD_GUILD_ID=1047724512873041941
DISCORD_OAUTH_ENABLED=false
```

`DISCORD_OAUTH_ENABLED=false` の間は Discord OAuth を構成せず、`student_directory`（名簿）の学籍番号と氏名が一致した利用者だけが利用を開始できる。Discord OAuth へ戻すときは値を `true` に変えるだけでよく、key は残す。値を変えたら `vp -C apps/api run cf-typegen` を実行する。

名簿は `学籍番号,氏名,局,担当,役職` の CSV から SQL を生成して適用する。局・担当・役職は任意で、列を省略しても空でもよい。担当を兼ねる場合は `野外ステージ|前夜祭` のように `|` で区切る。先頭行が `学籍番号` で始まる場合は見出しとして読み飛ばす。

```bash
vp -C apps/api run directory:seed 2026 ./directory.csv ./directory.sql
```

```bash
vp -C apps/api exec wrangler d1 execute shift-app --local --file ./directory.sql
```

remote へ適用するときは `--local` を `--remote` に替える。学籍番号は大文字小文字を区別せず、氏名は空白を除いて照合する。同じ学籍番号を再度流すと氏名・局・担当を更新する。局と担当は同名の年度 role があればサインイン時に付与されるため、CSV の表記は `year_roles` の名前に合わせる。

名簿の局と担当から不足している年度 role を作る場合も、id は dashed UUID で入れる。web は role の id を UUID として検証するため、`hex(randomblob(16))` のような形では一覧やチャット宛先の読み込みが失敗する。role は名簿より先に作る。`bureaus` と `duties` は作られた時点で同名の role を指すため、あとから role を足した場合は `role_id` を張り直す必要がある。

```bash
vp -C apps/api exec wrangler d1 execute shift-app --remote --command "INSERT INTO year_roles (id, year, position, name, color, created_at, updated_at) SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6))), 2026, 10, name, '#64748B', unixepoch()*1000, unixepoch()*1000 FROM (SELECT DISTINCT bureau AS name FROM student_directory WHERE year=2026 AND bureau IS NOT NULL UNION SELECT DISTINCT duty FROM student_directory WHERE year=2026 AND duty IS NOT NULL) ON CONFLICT (year, lower(name)) DO NOTHING"
```

環境 binding として注入する値:

```text
BETTER_AUTH_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
```

Web Pushを使う本番環境ではVAPID key pairを生成し、3値をWorker secretへ登録する。秘密鍵は`.env`や`wrangler.jsonc`へcommitしない。

```bash
vp -C apps/api exec web-push generate-vapid-keys
vp -C apps/api exec wrangler secret put VAPID_PUBLIC_KEY
vp -C apps/api exec wrangler secret put VAPID_PRIVATE_KEY
vp -C apps/api exec wrangler secret put VAPID_SUBJECT
```

`VAPID_SUBJECT`は`https://shift.kazui.dev`を使う。localで通知まで試す場合は別の開発用key pairを`.dev.vars`へ設定する。通常の画面・API開発だけなら不要。

OAuth profile、email、学籍番号の一致で account を暗黙連携しない。管理者承認による recovery だけを許可する。詳細な flow は `docs/requirements.md`、table 設計は `docs/database.md` を参照する。

Notion OAuth は将来拡張であり、現時点では設定不要。候補 workspace ID と検討事項は `docs/requirements.md` に残す。

検証、migration と本番反映の手順は [Contributing](../CONTRIBUTING.md) を参照する。
