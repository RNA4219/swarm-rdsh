# swarm-rdsh 作業規約

- 日本語で記載する。設計原本はdocs/design-v2.1/DESIGN_V2_1.md。原本のdigestを変更しない。本リポジトリは旧deepflow-swarmとは別構成で、独立したGit履歴を持つ。
- 外側の仕事・投入・復旧・統合はGas Town / Beads、agent loopはDSH、起動と高速ユーティリティはrustdshが所有する。
- 新規コードは接続アダプター、設定、プロトコル変換、契約試験に限定する。Scheduler、task DB、Merge Queue、Agent Loop、retry daemonを作らない。
- upstream.lockは設計候補のblocked状態。実体・profile・モデル経路・資格が未固定なら起動しない。
- 公開fixtureのworker完了・Refinery統合・TUI公開注入APIの実行記録はdocs/REAL_E2E.md。手動復旧とTUIの限定version例外を含む。通常deployment、private repo、全役割、保護PRでのRefinery統合の合格へ拡張して報告しない。
- 実行入口はgt-dsh。旧Pythonの制御基盤や旧Composeを新規に持ち込まない。
- 旧リポジトリ、保存した検証資材、既存変更・秘密・volumeを一括破棄しない。
- 初期構成はDSH Workflow/Subagent/Agent Teamsを無効化し、新worktree・新Sessionへ引き継ぐ。旧Sessionを別worktreeへresumeしない。
- worker/Refineryのmain直接pushを許可しない。自動統合は保護branchと必須Acceptanceの実E2Eまで無効。
- --check、固定delay、画面表示をreadiness証明にしない。モデル完了、gt done、Acceptance合格、統合完了を区別する。
- 外部送信停止、environment allowlist、read/network境界は別々に検証する。秘密値をログへ出さない。
- 検証はpnpm run typecheck、pnpm run lint、pnpm run buildの後、contract/lifecycle/integrationとdesign hashを確認する。実モデルE2Eの合格と混同しない。
