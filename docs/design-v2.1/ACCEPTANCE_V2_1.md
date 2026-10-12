# 受入試験表 v2.1

本表は試験仕様。合格の実測記録ではない。

| ID | 対象 | 合格条件 | 状態 |
|---|---|---|---|
| P00 | 未コミット保存 | 8件をレビュー報告として実棚卸し。staged/unstaged/untracked/必要ignoredを別directoryへ復元して一致 | 未実行 |
| L00 | 依存lock | 全required source/artifact/env/profileが完全固定。null/latest/rangeを拒否 | 未達 |
| A01a | TUI起動 | 固定DSH+TUI+rdshの正しいprofileを起動。first-run画面なし | 未実行 |
| A01b | readiness | 実PTY入力IDのSession受付＋gt primeのtool receipt一致。5秒sleepのみでは不合格 | 未実行 |
| A01c | readiness負例 | 遅延/破棄/別Session/permission待ちではreadyにならない | 未実行 |
| A02 | 投入経路 | 単一Town、N>0、遅延sling→schedulerのみ。禁止direct/manualを拒否 | 未実行 |
| A03a | 同時dispatch | 同じTownの同時scheduler runで同じ仕事を重複起動しない | 未実行 |
| A03b | 投入後DB障害 | spawn後close失敗時に次の再投入を止めて照合。exactly-once保証にしない | 未実行 |
| A04 | DAG | 未完了/失敗/循環/依存変更のfixtureを固定経路で確認。統合依存の意味を別定義 | 未実行 |
| A05 | workspace | 別worktreeへの誤書込み拒否と回収差分の検査 | 未実行 |
| A06 | 復旧 | 旧process終了確認→保存→新worktree・新Session引継ぎ。旧Sessionを再bindしない | 未実行 |
| A07 | 状態区別 | DSH turn完了、gt done、検証合格、MR統合を同一視しない | 未実行 |
| A08a | 必須Acceptance | 空command/0test/skipのみ/証拠欠落/timeoutをFAIL | 未実行 |
| A08b | baseline失敗 | 既存失敗を理由にマージしない | 未実行 |
| A08c | 強制ゲート | required check未合格、無権限直接push、偽結果、未承認reviewを拒否 | 未実行 |
| A08d | 古い結果 | base/head/tree/policy変更で旧検証を無効化 | 未実行 |
| A09 | 逐次MR差戻し | 標準経路で失敗したMRを保留・修正へ戻し、勝手に統合しない | 未実行 |
| BIS01 | batch二分 | 公開入口＋call path＋実E2Eが揃うまで保証から除外 | 採用保留 |
| A10a | 追加ログ | DeepSeek SessionログとOTelを別々に停止。許可model body内の付加ログも検査 | 未実行 |
| A10b | 設定/env | host env/.env/.dsh-tui/credentials/任意proxyによる送信先やモデル変更を拒否 | 未実行 |
| A10c | 読取り | 禁止領域canaryをshell経由含め取得できない | 未実行 |
| A10d | 全lifecycle通信 | 起動/turn/feedback/再起動/終了/失敗diagnosticsのDNS・送信本文を確認 | 未実行 |
| M00 | 旧経路撤去 | clean installと旧CLI残存環境の両方で旧接続を使わず衝突はfail | 未実行 |
| A11 | 16並列 | queued/Polecat/管理役/子agent/LLM inflight/retry/cost/p95を分けて測定 | 未実行 |
| A12 | 100並列 | 同上。100件queue保持と100モデル同時通信を区別。前段階合格後のみ | 未実行 |

各結果に固定ソース、実体hash、OS/arch、入力fixture、コマンド、時刻、exit status、Session/Bead/MR/base/head/tree/policy識別、ログ参照を付ける。秘密を含む証跡はアクセス制限した別保管とする。
