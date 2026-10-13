# 未コミット変更のレビュー

2026-10-13、診断ツール以外の未コミット変更7ファイルも確認しました。実ターゲットの通信、モデル負荷試験、配布は実行していません。

## 今回の統合

`adapters/gt-dsh/src/adapter.ts`と`tests/adapter-contract/fixture.test.mjs`の公開fixture用HOME分離を取り込みます。HOME作成前にGas TownのroleとPolecat識別子を照合する修正、識別不一致・範囲外の負例を追加しました。

これはHOME設定の分離です。別workerのファイルへのOSレベルの書込み隔離、本番資格、自動復旧の合格を意味しません。通常CLIによるqualification-fixtureの拒否を維持します。

## 指摘と修正

| 対象 | 所見 |
|---|---|
| `tools/qualify-load.mjs` | 停止条件と完了の同時成立がpassedになる問題を修正。監視欠落でも停止する。schedulerの停止は所有する子processだけを対象とし、SIGTERM後も残る場合は停止を強制 |
| 同上 | 最大process数と累積SessionサイズではLLM同時inflightやAcceptanceを証明しない。判定をinfrastructure smokeに限定し、本番・LLM・成果物検証の未確認fieldを明示 |
| `upstream.lock` | 証跡の許可fieldのみを公開用JSONへ抽出しdigestを固定。16/32ノードの記録をinfrastructure smokeとして扱う。過去のadapterの実E2E hashは履歴として保存 |
| `tools/decepticon-rsi-bridge.mjs` | 共通の操作許可検査を追加。操作不許可を復旧確認で上書きする問題、通信枠の小数、不正boolean、空・未知pathをローカルで修正。資格状態の語彙不一致は本番接続契約の未解決事項として残す |
| `tests/integration/decepticon-rsi-bridge.test.mjs` | 操作不許可・不正型・空path・未知pathの負例をローカルで追加。共通の拒否検査は独立した純粋なhelperとテストを今回のPRへ含める |
| `docs/DECEPTICON-RSI-BLACKBOX.md` | 指示文の生成と実際の強制は別であることを追記。合成smokeから実ターゲットの配備資格へ拡張しない |

元の合成負荷記録は4・8・16・32ノードのpassedを記録しています。その事実と、本レビューで確認した合格判定の証拠範囲を区別します。修正後のharnessによる実モデル負荷試験は再実行していません。

ブリッジ本体・固有テスト・説明の3ファイルはローカルで保持します。実ターゲットへ自律的な侵入テストを展開する連携の公開・有効化は今回のPRへ含めません。本番の配布許可・資格を発行する機能も追加しません。
