# v2.1 実装・検証記録

実施日: 2026-10-12〜13。固定runtime/TUIのビルドと、公開fixtureでの実モデルworker完了・Refinery統合まで実施しました。詳しい結果と手動復旧は[REAL_E2E.md](REAL_E2E.md)を参照してください。接続コードと照合結果を、新規リポジトリswarm-rdshへ分離して公開します。

## 完了した作業

- 履歴bundle・index・binary diff・作業file50件をrepo外へ保存し、別ディレクトリで復元とstatus/digest一致を確認。ユーザー限定ACL。基準tagも作成。
- 添付ZIPの6ファイルをdocs/design-v2.1へ取り込み、記載された4ファイルのSHA-256一致を確認。
- TypeScript製gt-dshの起動前検査を実装。固定source SHA、rdsh/DSH/Node実体、profile、model route、専用HOME、worktree、役割、資格を検査。
- 許可したGas Town識別情報と選択providerのcredentialのみを起動環境へ渡す。proxy、Node preload、汎用token、旧Sessionは継承しない。
- Linuxの通常起動はexecveによる委譲。独立Scheduler・task DB・Agent Loop・retryは追加していない。
- Gas Town設定例、worker profileテンプレート、Node用package/依存lock、CIを追加・更新。
- WSL UbuntuへNode 24.15.0 linux-x64を公式checksum照合後に配置。既存Node/global PATHは変更していない。
- 固定Gas Town、DSH、rustdsh、TUI/vendor、Beads CLI 1.0.5をビルド。Dolt 2.0.7を公式checksum照合後に配置。
- DSH公式native buildのlandlock-run、glibc/musl system.nodeとlibrary compileを完了。TUIのビルド済みconsumerリンクを固定DSHへ接続。
- worker profileのDeepInfra endpoint/model固定、worker用tool、委譲・認証探索・外部観測送信停止を設定。
- Gas Townの初期promptをargでDSH TUIへ渡し、専用HOME・新Session・bubblewrapで公開fixtureを実行。
- DS4.1 Flashがコードを修正し、3assertion合格、commit、gt done、Bead df-2klのclosed、MR df-wisp-25vの登録を確認。worker終了時点のmainは未変更。翌日のRefinery試験でfixture mainへの統合を確認。
- head=GLM-5.3、medium=GLM-5.3-Flash、lower=DS4.1-Flashのモデル設定資料を保存。GLM側の実ジョブと全役割割当は未検証。

## 検証

| 検査 | 結果 |
|---|---|
| TypeScript typecheck | 合格 |
| ESLint | 合格 |
| adapter build | 合格 |
| Windows変更対象contract/integration | 12件合格、Linux専用1件skip、4.36秒 |
| Windows lifecycle初期確認 | 子process終了コード・起動失敗を確認。POSIX信号試験はskip |
| WSL Linux全試験 | 20件合格、0失敗、0skip、最終9.31秒 |
| 原本設計digest | 4件一致 |
| 既存Python source/tests変更の保持 | 保存時digestと6件一致 |
| CLI診断 | 未配置runtimeを検出。未指定modelを終了コード2で拒否 |
| npm配布物 | ビルド済みCLIを含み、旧Python・旧runtime設定・.envを含まない。展開したCLIのhelpが起動 |
| 固定runtime/native/TUI build | 完了。TUI可搬tarballは未完成 |
| 実モデルworker/Refinery E2E | 公開fixtureで完了・MQ登録・統合・統合後テスト・MQ cleanup。手動復旧あり |
| TUI公開注入API | 短いsandbox HOMEでSessionへの継続入力・応答を確認。通常nudgeは未資格 |
| 固定Gas Town Refinery上流テスト | 23件合格（subtestを含む）、本体11.206秒 |
| 公開用文書とlicense | 謝辞、採用runtime 7件の上流license台帳、122件の開発依存SBOM、release/secret checksを追加 |

Linux試験はWSLからWindows側の作業ツリーを参照して実施しました。Windowsの初期全試験は4.03秒、Linuxの直前16件は9.89秒、初期prompt契約を追加した18件は10.51秒です。OS、実体のサイズ、filesystemが異なるため、Windows/Linux差だけで実装の遅さと判定しません。関連試験の合格後、追加の負荷試験は行っていません。

adapterの単体契約試験runtimeは疑似実体です。通常CLIからPID・引数・cwd・stdin/stdout・終了コード17を保持すること、SIGTERM伝搬、再投入がないことを確認しました。実DSH/TUI/DeepInfra/Gas Townの公開fixture E2Eは別に記録しています。gt done後の消えたprocessだけで成功にせず、Beads・Git・既存MQを照合しました。

新規swarm-rdshへ分離した後、固定Node 24.15.0・pnpm 10.20.0でtypecheck・lint・build・原本設計4件のdigest・ライセンスとSBOMを再確認しました。WSL Linuxの契約試験20件が0失敗・0skip、9.42秒で合格しました。分離前の同じ環境での9.31秒と同程度です。47 entryの配布物を作成し、展開したCLIのhelpが起動すること、実DeepInfraキーがGit公開候補・履歴・配布物にないことを検査しています。実モデルの試験は既存の照合記録を引き継ぎ、モデル処理の再実行とは区別しています。

## 残作業

1. 固定DSH/TUIの正式version互換性と可搬package。推移依存のSBOM・license棚卸し。
2. 実効tool全件の動的確認、private repo用read/network境界、privacy canary、正式deployment lock。
3. 継続nudgeのterminal契約、Unix socket path、Witness/Deaconによる自動復旧。
4. DAG・同時投入・全Gas Town役割と3段階モデルの接続。
5. 保護されたPR経由のRefinery統合とAcceptance、16/100並列。公開fixtureの直接統合は確認済み。
6. 固定runtimeとfixtureスクリプトの可搬セットアップ。旧構成のDB・volume・CLI整理は別リポジトリ側で扱う。

upstream.lockは引き続きblockedです。実モデルは公開fixtureだけで使用し、通常deployment・自動main更新は有効化していません。新規リポジトリでの公開と、安定版Swarmの実運用資格は[RELEASE.md](RELEASE.md)の基準で区別します。
