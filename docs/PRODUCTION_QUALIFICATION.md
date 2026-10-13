# 本番資格の不足を調べる

`production-deployment-not-qualified` と `production-e2e-not-qualified` は資格不足の集約ラベルです。未実装の関数が2つという意味ではありません。

調査したローカルの追加検証記録には、合成fixtureの4・8・16・32ノードと同時dispatchの結果があります。その未コミット記録のレビューは[UNCOMMITTED_REVIEW.md](UNCOMMITTED_REVIEW.md)に記載します。本変更はrootの資格記録を書き換えません。rootの`upstream.lock`は設計候補で、本番E2Eは未資格です。個別のブラックボックス試験・作成削除試験・可用性スモーク試験と、エージェント実行基盤の本番資格は別の証跡です。

## 読み取り専用の診断

Gitのsource checkoutから実行します。診断スクリプトは開発用で、アダプターのnpm形式tarballには同梱しません。

```powershell
node tools/inspect-qualification.mjs
node tools/inspect-qualification.mjs C:\work\upstream.lock
```

設計候補、未解決要件、通常起動に必要な資格、E2Eの試験範囲、合成負荷試験を分けて表示します。資格は発行せず、lockの変更、worker起動、対象向け通信、配布を行いません。終了コード2は資格不足または独立した証跡レビューが必要な状態、3は入力不正です。自由文・endpoint・credential・Session本文を出力へ転記しません。

## 残っている要件

| 要件 | 不足しているもの |
|---|---|
| OS / libc | イメージdigestと可搬deploymentの確認 |
| TUI推移依存 | 可搬package、native資材、完全なライセンス棚卸し |
| 実効worker profile | 全toolの動的確認とprivate環境の境界試験 |
| Acceptance | 保護された統合経路での必須検査証跡 |
| Molecules | 永続工程の契約試験 |
| 全管理役 | 環境allowlistと起動・停止の実契約試験 |
| モデル経路 | head / mediumの実ジョブと全役割への接続 |
| DSH / TUI | version例外に依存しない正式互換性 |
| 通常nudge | 入力受付と応答の照合 |
| 自動復旧 | Witness / Deaconによる復旧の実試験 |
| Refinery | 保護PR経由の統合と失敗時の差戻し |
| privacy canary | 禁止領域と全lifecycle通信の境界試験 |

通常deployment用lockの生成・署名と証跡の信頼確認は、[アダプター契約](../adapters/gt-dsh/README.md)で未実装とされています。この読み取り専用診断は、その生成機能や本番E2Eの代わりにはなりません。集約フラグを書き換えて未確認の資格を合格にしません。

実行基盤を確認する際は、既存の合成fixtureの記録と本番証跡を分けて維持してください。原本設計の試験仕様を、実測済みの結果へ書き換えません。
