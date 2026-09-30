# 0006 Vite+ 1.0 の導入時に既存 UI の React Compiler 指摘を分離する

- 状態：採用
- 決定記録日：2026-09-30
- 実装状況：実装済み

## 背景

Vite+ 1.0 への更新で Vitest 5 と新しい lint 規則が導入された。既存の Web コードには React Compiler 関連の 57 件の指摘があり、参照、状態、effect、TanStack Router の hook 呼び出しに分布する。これらを一度に書き換えると、ツール更新と画面動作の変更が混ざる。

## 決定

- Vite+、Vitest、CI の更新を先に行い、テスト、coverage、型検査、build、preview で動作を確認する。
- `react/rules-of-hooks` は引き続き error にする。
- Web の既存コードに対する `react/exhaustive-effect-dependencies`、`react/hooks`、`react/immutability`、`react/refs`、`react/set-state-in-effect` は一時的に無効にする。対象は `apps/web` に限定し、他の package では維持する。
- これらの規則を有効に戻す作業では、画面ごとに挙動を検証しながら修正する。

## 影響

Vite+ 1.0 の導入を、既存 UI の広範な書き換えから分けて検証できる。Web では上記 5 規則による新規違反も検出されないため、後続の修正で再有効化が必要になる。
