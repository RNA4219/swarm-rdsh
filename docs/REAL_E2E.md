# Gas Town + DSH 実モデル1ジョブの記録

実施日: 2026-10-12〜13。公開の合成fixtureで、Gas Town Schedulerから起動したrustdsh + DSH + TUIがコードを修正し、検証・commit・gt done・Beads完了・Refineryキュー登録まで進みました。続いて既存Refineryから同じDSH runtimeを起動し、統合・統合後テスト・MQ cleanupまで確認しました。手動復旧を含み、通常運用の資格は未達です。

## 2026-10-12のworker結果

| 対象 | 実測結果 |
|---|---|
| 割当Bead | `df-2kl`、closed、2026-10-12 23:12:09 JST |
| 修正 | `add(a,b)`の減算を加算に変更 |
| Acceptance | `node sum.test.mjs`、3件のassertion、`ACCEPTANCE_OK` |
| worker commit | `af1af6f2f5ed3342c9979c559707c9ec7b93687c` |
| 公開されたworker branch | `polecat/rust/df-2kl+mv5bgour`、fixtureのローカルbare originへpush |
| Refineryキュー | `df-wisp-25v`、open、source_issueとcommit SHA一致 |
| main | `4a59ff06f9f0d21394a5f435bd258bf0386bcbdc`、baseから変更なし |
| 実モデル | DeepInfra、`deepseek-ai/DeepSeek-V4.1-Flash` |
| 最終DSH Session | `6aacad55-64ff-44e9-a91c-c7ed3462f1a5` |

実際のDSH Sessionにgt prime、コード編集、Acceptance、gt doneのtool callがあります。最終gt doneはGas Townがtmux Sessionを終了するため、DSH側の最終tool resultは残りません。成功判定は独立したBeads状態、既存MQ、Git commit、remote branch、Acceptanceを照合しました。画面表示や消えたprocessだけでは成功としていません。

公開用の機械可読な照合結果は[qualification-20261013.json](evidence/qualification-20261013.json)です。元の詳細結果はローカルWSL側の`qualification-20261012/evidence/REAL_E2E.json`に保存しています。会話の正本はDSHの圧縮Sessionのまま維持し、公開記録には照合結果・元Sessionのdigest等だけを収録しています。

## 固定してビルドした資材

| 資材 | version / source commit |
|---|---|
| Gas Town | 1.2.1 dev、`649b832b7672bc7a2dbef26f5983aba6198b819b` |
| DSH | 0.2.1-alpha.2、`d743267388641bc76f17c45ce8b4c231aed1d32c` |
| rustdsh | 0.3.2、`a1be438e232278add3ee130e7d77aaa02f9f68c5` |
| dsh-TUI | 0.14.0、`76c2a26b7f0d81e91b04c848e8aa9671f93ed046` |
| TUI vendor/dsh-std | `614dfa1ac168db79fcf4577cf0ebb34e2e3b944b` |
| Beads CLI | 1.0.5、`6a3f515ced18406c189c55fff789a4925bfaa35c` |
| Dolt | 2.0.7、公式release archiveのchecksumを照合 |
| Node / Go / Rust | 24.15.0 / 1.26.2 / 1.95.0 |
| pnpm | adapter 10.20.0、DSH 11.28.5、TUI 11.21.0 |
| OS / Git / tmux | WSL Ubuntu 24.04 x86_64、glibc 2.39、Git 2.43、tmux 3.4 |

実行資材は`/home/ryo-n/.local/share/deepflow-swarm/`配下に配置しました。上流の内部ソースは変更していません。DSHは公式native buildでlandlock-runとglibc/muslのsystem.nodeを生成し、公式library compileを実行しました。TUIも固定vendorを含めてビルドしました。完全なsource SHA、バイナリdigest、source lock、native asset digestは[upstream.lock](../upstream.lock)に記録しています。

Beads CLI 0.57.0では固定Gas Townの埋込みBeads 1.0.5とschemaが一致しませんでした。1.0.5を固定Go moduleからビルドして接続しました。再準備する場合はGas Townの後に`tools/build-fixed-runtime.sh beads`を使用します。

TUIのビルド検査は元のdev依存組合せで90/91件が通り、terminal dimensionsを固定したimage-previewの再検査も通りました。その結果を固定DSH alphaとの全互換性の合格として扱いません。可搬tarball作成は未完成です。hoisted installは約600秒のnetwork/optional依存取得待ちとなり、比較可能な成功時間がなかったため見込みは不確実でした。停止後のfocused試行では固定lockのplatform依存不足を確認し、元のisolated依存を復元しました。今回の実行はビルド済みソースへのconsumerリンクを使用しています。

## 接続とprofile

Gas Town Custom Agent Presetは`prompt_mode: arg`で初期指示を渡します。gt-dshがliteral argvでrustdshへ委譲し、TUIの標準初期promptで起動します。no-hooksのtmux配送だけでは初期指示が消えたため、この公開接続境界を使用しました。fixtureでは実際のpane process名`bwrap`をprocess_namesに追加しています。5000msのdelay自体をreadiness合格にはしていません。

worker profileはDSH backend、固定DeepInfra endpoint、worker用presetを使用します。Workflow/Subagent/Agent Teams、認証探索、更新監視、外部観測送信を停止しています。合成設定の静的検査と実際のbash/read/edit使用を確認しました。実効tool一覧全件の動的棚卸しは未完了です。

TUI 0.14.0の宣言するDSH version範囲に0.2.1-alpha.2が含まれないため、公開fixtureでのみ公式`dsh plugin allow-version`の完全version例外を使用しました。TUIのdev依存はconsumerリンクを固定DSHへ接続しています。正式deploymentの互換性合格は残しています。

専用HOME・DSH_HOME・新Sessionを使用し、外側のbubblewrapでhost HOMEと実repositoryを隠しました。fixture townをwrite可能にし、model APIとローカルDoltへの通信を使用しました。これはprivate repoのnetwork制限や全秘密境界を証明しません。APIキーのDSH Sessionへの平文混入は検出されませんでした。APIキーはGit/npm除外済みの`.env.deepinfra.local`から必要なprovider変数だけで渡しています。

## 手動復旧と未解決点

最初の実装Sessionは修正とcommitまで進みましたが、Gas Townの管理用`.beads/`・`.runtime/`・`CLAUDE.md`を未追跡と判定し、gt doneが止まりました。管理用ファイルを削除せず、共有Gitのinfo/excludeへ追加しました。

継続`gt nudge`はEnterの受信確認に失敗しました。TUIの公開注入APIも長すぎるUnix socket pathで接続に失敗しました。これらを合格としていません。独立した配送daemonやretryを追加せず、Git状態とMQ未登録を確認し、既存`gt session stop/start`で同じBead・worker・worktreeを新しいDSH Sessionへ引き継ぎました。再実装や同時二重投入は行っていません。そのSessionが再検証してgt doneを実行しました。

このworker試験終了時点ではWitness/Deacon/daemonによる自動復旧と後片付けは未検証で、workerはidle-recovery-needed、Refineryの統合要求はopenでした。翌日の統合結果は次節に分けています。保護PR Acceptance、DAG・競合投入、16/100並列、private canary、OpenSandboxは合格範囲に含みません。通常CLIのdeployment lockは引き続きblockedです。

## 2026-10-13の追加検証

公開fixture内のHOMEをbubblewrapで`/df/home`へbindし、TUIのUnix socketを短くしました。上流の公開注入プロトコルで継続入力を渡し、その入力と応答を同じDSH Session `ffc219d0-7a40-4604-b73f-3060e306fe0e`で確認しました。Gas Townの通常nudgeのEnter receiptを合格にしたものではありません。

既存`gt refinery start fixture --agent dsh-worker`から、新HOME・新DSH SessionでRefineryを起動しました。専用fixture overlayは合格したworker presetを再利用し、role personaだけを変えています。最初のoverlayでpreset IDとfs-searchの必須設定が不足した失敗を確認して修正しました。起動コマンドのsuccessやprocess消失をreadinessとして扱いません。試験環境のDolt停止や保存済みTUI設定の拒否も記録し、正式資格を緩めず、新attemptで検証しました。

最終Session `3bca556a-0095-40de-9b9a-653d5787ac55`に11件のbash tool callがあります。gt prime、既存MQの確認、merge rehearsal、3assertionのAcceptance、mainへの統合・push、統合後テスト、`gt mq post-merge`を確認しました。MR `df-wisp-25v`はclosed、close reasonはmerged、fixture origin/mainは`af1af6f2f5ed3342c9979c559707c9ec7b93687c`です。提出headのmain包含もGitで照合しました。

試験harnessでは空のMQがJSON `null`で返ることを確認し、空arrayとして扱う修正後に状態を読み直しました。queueが空というだけでは合格にせず、MR・remote main・commit包含・Acceptanceを確認しています。モデル処理を再実行せず、検証側の修正と再照合で結果を確定しました。公開fixtureのrole制約付きhookを使った統合であり、GitHubのrequired checksや承認付きPRでのRefinery統合は未資格です。

固定Gas TownのRefinery上流テスト23件（subtestを含む）が合格しました。対象は提出head、sourceの再照合、PR/head/review、直接pushの分岐等です。テスト本体11.206秒、初回compileを含む全所要時間は比較可能な基準がないため性能判定に使用しません。ローカルのadapter試験は20件、0失敗・0skip、9.31秒です。公開用の機械可読証跡は[qualification-20261013.json](evidence/qualification-20261013.json)です。Session本文やAPIキーは含めていません。

## モデルの3段階

[model-tiers.json](../config/model-tiers.json)にhead=`zai-org/GLM-5.3`、medium=`zai-org/GLM-5.3-Flash`、lower=`deepseek-ai/DeepSeek-V4.1-Flash`を保存しています。これは役割ごとに固定して選択する設定資料です。全Gas Town管理役への割当や3段階間の委譲は未実装・未検証です。タスク状態・再投入・統合の所有者はGas Town/Beadsのままです。

最初の短いAPI確認でmediumは2回429 Model busy、headは60秒でtimeoutしました。lowerの疎通成功後、同じ公開タスクをlowerで実行しました。翌日の再確認ではheadはHTTP 200でモデルIDが一致しましたが、要求したREADYとの完全一致は未確認です。mediumは再び429でした。head/mediumのDSH実ジョブを合格とはしていません。モデル性能の優劣を判定した結果ではなく、自動fallbackも追加していません。実ジョブ全体の費用は未集計です。

## 検証

adapterのtypecheck・lint・build、Linuxのcontract/lifecycle/integration 20件（0失敗・0skip、9.31秒）、原本設計4件のdigestを確認しました。直前の18件10.51秒と同じWSL/Windows filesystem上の試験です。実モデルE2Eとは別の検査として記録しています。実repositoryのコードをモデルへ投入せず、モデルによるmain統合は合成fixtureに限定しました。実モデル試験は新規リポジトリの公開前に行った証跡であり、GitHubのPR検査とは区別します。
