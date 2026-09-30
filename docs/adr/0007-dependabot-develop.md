# 0007 Dependabot PR を develop に集約する

- 状態：採用
- 決定記録日：2026-09-30
- 実装状況：実装済み

## 背景

変更は `develop` で検証し、リリース時に `main` へ反映する。Dependabot の通常更新は `target-branch` で `develop` を指定できるが、GitHub のセキュリティ更新は常にデフォルトブランチへ作成される。

## 決定

- npm と GitHub Actions の通常更新は `.github/dependabot.yml` の `target-branch: develop` で向ける。
- セキュリティ更新PRは、CI の `workflow_run` 完了後に GitHub API で base を `main` から `develop` へ変更する。対象は作成者が `dependabot[bot]` のオープンPRだけに限定する。
- この処理はPRのコードや成果物を読み込まず、`pull-requests: write` の権限だけを使う。CI は base の変更を含む `edited` イベントにも対応する。
- 両方の設定は GitHub のデフォルトブランチである `main` へ反映して有効にする。

## 影響

通常更新とセキュリティ更新のPRを `develop` で扱える。セキュリティ更新は作成直後からCI完了まで一時的に `main` を向く。`main` と `develop` の依存関係に差がある場合、base変更後に競合や追加の更新が必要になる。
