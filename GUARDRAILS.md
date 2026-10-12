# Guardrails

- 設計候補を動作確認済みの構成として報告しない。
- 不明な終了・空Acceptance・未実行・timeout・既存baseline失敗を合格にしない。
- アダプターは1回だけ起動を委譲する。job lease、retry、heartbeat、独立キューを持たない。
- worktreeのルートとrole識別情報を確認する。別worktreeの未統合内容を変更しない。
- 各attemptに専用HOME/DSH_HOMEと新Sessionを使用する。共有設定・保存済みTUI設定を無条件に継承しない。
- read/network境界とprivacyの実試験前にprivate repoを投入しない。現在の実profileは公開fixtureの接続だけを確認しており、この資格を持たない。
- rootのモデル経路、固定実体、profile digest、資格が未確定なら通常起動を拒否する。
- worker・Refineryからmainを直接更新しない。Refinery二分処理は公開経路とE2Eが確認されるまで採用保留。
- 旧リポジトリの既存変更・保存資材を破棄しない。秘密のbackupはrepo外のアクセス制限した場所へ置く。
