# DeepFlow Swarm 再構成設計書 v2.1 — 固定コミットレビュー反映版

日付: 2026-10-12  
状態: **設計候補。正式採用・実装開始のうち破壊的移行は保留。**  
適用: v2.0の採用構成を維持し、本書と矛盾する保証・設定例・受入条件を置換する。

## 0. 採用構成と証拠の扱い

採用候補は **Gas Town / Beads + DeepSeek Harness + rustdsh**。Gas Townを唯一の外側のタスク・投入・統合管理者、DSHを各ワーカー内のagent loop、rustdshを起動・高速ユーティリティとする。DeerFlow/OpenCode/独自Python司令塔は新しい主経路に残さない。新たなScheduler、Merge Queue、タスクDBは追加しない。

ただし「ソースに機能がある」「通常経路から呼ばれる」「この組合せでE2Eが通る」は別の証拠である。`source_confirmed`、`path_confirmed`、`e2e_passed`を区別する。本文中の運用ルールは設計要求であり、現在の環境が満たしているという報告ではない。

今回の更新は設計ファイルの作成だけである。ユーザーの作業ツリー、Git tag、GitHub設定、ソースコードは変更していない。ローカル未コミット8ファイルはレビュー報告値であり、ファイル名と差分はこの環境では未取得。実サービスE2E、16並列、100並列は未実行。

## 1. TUI・worker profileの固定

### 1.1 ソース固定

| 対象 | 固定候補 |
|---|---|
| Gas Town | `gastownhall/gastown@649b832b7672bc7a2dbef26f5983aba6198b819b` |
| DSH | `deepseek-ai/deepseek-harness@d743267388641bc76f17c45ce8b4c231aed1d32c` |
| rustdsh | v2.0選定値 `jimoto-no-llm/rustdsh@a1be438e232278add3ee130e7d77aaa02f9f68c5` を保持。今回は再ビルド・互換試験未実施 |
| TUI | `ccch1mneyyy/dsh-TUI@76c2a26b7f0d81e91b04c848e8aa9671f93ed046` |
| TUI package | `@deepseek-harness-tui/dsh-tui`、同コミットのmanifest version `0.14.0` |
| profile | `deepflow-worker-v2_1` |

固定DSHの自動初期化対象はweb/headless/sdk/sdk-minimal/acpであり、`tui`を同梱profileとみなさない。[S1]
TUIは上記の既存プラグインを採用候補として固定する。上記versionのnpm tarballとソースの同一性は未確認なので、ソースcommitを正本とし、ビルド生成物と依存lockのchecksumを別途固定する。READMEの互換性記述は、固定DSHとの本システムE2E合格を意味しない。[S7][S8]

### 1.2 worker構成

構成順を `DSH base → 固定TUI bundle → worker専用設定 → 最終privacy/policy override` とする。profile、DSH_HOME、HOMEはworktree/attempt専用とし、通常利用中のweb/tui/desktopや共有HOMEを書き換えない。

起動契約は `gt-dsh → rdsh --profile deepflow-worker-v2_1`。`rdsh tui`や、TUIの自動更新・profile自動修復に依存する起動は使わない。SDKへrdshのRustバイナリを`dshBin`として渡さない。

| 項目 | 設計値 |
|---|---|
| TUI backend | `dsh`のみ。別kernelへの切替・記憶された選択は不許可 |
| model route | provider/model/endpointの組を明示し、実効値を起動時に照合 |
| task内委譲 | v2.1初期合格構成ではWorkflow/Subagent/Agent Teamsをモデルから利用不可にする |
| 実行途中の構成変更 | HMR、plugin追加、/update、kernel/model切替を許可しない |
| TUI表示 | inline、画像表示OFF、起動案内を事前完了。入力経路はPTYで試験 |
| TUI追加retry | `upstreamRetry: false`。同一要求のretryをDSHまたはゲートウェイの一方で明示固定 |
| 設定の保存領域 | 専用HOME内の`.dsh-tui`も検査対象。settings/model/effort/preset等の保存値を固定 |
| 自動通信 | version確認、認証検出、追加backend/拡張/更新用通信は許可しない |

TUIはDSH_HOMEとは別にHOME配下の`.dsh-tui`へ設定・選択を保存し、保存値がprofileを上回る場合がある。`upstreamRetry`も既定でretry policyを補う機能である。このためprofileのYAMLだけでは実効設定を固定したことにしない。[S8][S9]

付属`worker-profile.policy.json`はこの構成の**宣言的仕様**、`privacy.override.cordis.yml`は固定DSHで存在を確認した行への無効化候補である。これは完成済みのprofileインストーラーではない。TUIのpreset内で再登録されるツールも含め、実際のtool schemaと実行拒否を試験する。root行のdisableだけで委譲停止を証明しない。

### 1.3 readiness契約

5秒の固定待機は合格条件から削除する。delayは起動補助であってreadinessではない。次の順序を記録する。

1. `process_alive`: 正しい実体・profile・workspaceでプロセスが存在する。
2. `input_accepted`: tmux/PTYの実際の配送経路から送った一意な試験IDが、対象DSH Sessionの入力受付記録に残る。
3. `context_loaded`: その起動世代で実行した`gt prime`のtool-call、exit status、出力参照が残り、割当Bead/role/rigと一致する。
4. `worker_ready`: 上記を満たし、policyの実効値検査が成功する。

単に画面へ同じ文字が表示されたこと、adapterが起動前に`gt prime`を実行したこと、モデルが「読んだ」と回答したことは証拠にしない。遅い起動、入力破棄、first-run画面、permission待ち、異なるSessionへの誤配送も負例にする。

信頼できるreadinessの取得に足りない箇所は接続adapterの範囲で補う。独立した投入キューは作らない。上流の固定遅延fallbackのまま試験が通らない場合、正式採用を止める。新規receipt形式は設計契約であり、上流に既に存在すると扱わない。[S2]

## 2. Schedulerの保証範囲

### 2.1 対応する投入経路

v2.1の保証対象を以下へ限定する。

- 単一Linux実行ホスト、単一Town、単一の共有されるscheduler lock領域。
- `scheduler.max_polecats = N > 0`。
- 新規の仕事は許可された`gt sling`の遅延投入経路から登録し、同じTownの`gt scheduler run`/daemon dispatchを通す。
- 手動Polecat起動、direct dispatch、別Town、workerからの独自spawn、DSHの外側委譲経路は対象外として禁止/拒否を試験する。

設定名が存在することだけで、全起動経路にDAG・重複防止が効くとはしない。workerへ与えるコマンド権限は役割別とし、禁止経路をプロンプト上の依頼だけで防いだと扱わない。

固定実装はexclusive lock、ready判定、投入後のcontext closeを持つ。ただしワーカー起動後にcontext closeが繰り返し失敗すると二重投入の危険を明記している。**exactly-once、全障害下の重複ゼロは保証しない。**[S3]

### 2.2 障害時

起動済み/未起動を確定できない場合は、既存の`gt scheduler pause`で新規dispatchを停止し、Polecat、tmux、Beads、Git、MR状態を照合する。障害試験で次のdispatchより前に停止・照合へ移れないならA03未達とする。「注意書きを加えて合格」にはしない。初期運用ではこの障害の復旧を手動とし、新しいretry daemonは作らない。

Beadsのtask closedと成果物の検証済み/統合済みも区別する。A04は単純な依存辺だけでなく、前提の完了条件がtask完了か統合成功かをfixtureごとに明示する。

### 2.3 計測を分離

`queued_beads`、`polecats_starting/running`、`manager_agents`（Mayor/Witness/Refinery/Deacon等）、`dsh_child_agents`、`llm_inflight`、`llm_retries`を別系列で測る。SchedulerのNはPolecat枠であり、全DSH数でも全モデル通信数でもない。タイトル生成、要約、管理役の通信も`llm_inflight`へ含める。

v2.1の最初の測定は子委譲0で行う。子委譲を将来有効化する場合は別profile・別試験とし、親数×子上限の設定だけを実モデルの同時数保証にしない。

## 3. Refineryの採用範囲

**採用候補は標準の1 MRずつのmerge rehearsal・検証・差し戻し。batch-then-bisectは採用保留。**

`internal/refinery/batch.go`に処理実装はあるが、それだけでは固定commitの通常起動経路から呼ばれる証明にならない。[S4] 公開設定名を推測して追加したり、internal関数を呼ぶ独自daemonを作って「既存Refineryを使用」と扱ったりしない。

二分処理の保留解除には、固定commitでの公開CLI/設定入口、入口から処理までのcall path、複数MRのうち特定組合せが失敗するE2E、分割後の再検証・cleanupの証跡を必要とする。Phase 3/A09にはこれを保証機能として含めない。

## 4. Acceptanceとマージの強制条件

### 4.1 合格規則

| 条件 | 判定 |
|---|---|
| 必須commandが空、存在しない、未実行 | FAIL |
| 必須testが0件、skipのみ、証跡なし | FAIL |
| setup/typecheck/lint/test/buildの必要項目が非0終了 | FAIL |
| timeout/cancel/実行環境不明 | FAIL |
| 統合先baselineに既存失敗がある | FAIL。原因記録だけで統合しない |
| 独立reviewが不在、取得不能、未承認 | FAIL |
| 検証後にbase/head/tree/policyが変更 | 旧結果を無効化し再検証 |

非対象カテゴリは、作業開始前に承認された理由とpolicy hashを固定する。空文字による黙示skipと、実行中のモデルによる非対象化を禁止する。既存失敗に対する自動例外は設けない。

### 4.2 必須commandの固定単位

各rigへ`acceptance.lock`を用意し、各commandのargv/cwd/env、timeout、test件数条件、toolchain/image digest、対象base/head、policy hashを固定する。対象プロジェクトに存在しない`npm test`等を推測して埋めない。

再構成後の**接続adapter packageに要求するscript契約**は、`pnpm run typecheck`、`pnpm run lint`、`pnpm run test:contract`、`pnpm run test:lifecycle`、`pnpm run test:integration`、`pnpm run build`。依存導入は固定lockから`pnpm install --frozen-lockfile --ignore-scripts`を基本とし、ビルドに必要な個別scriptは承認済みのbuild手順へ分離する。これらは新packageへの設計要求であり、現行Pythonリポジトリで実行可能とする記述ではない。script未実装はFAIL。

任意の開発対象repoは、そのrepoで確認・承認したcommandへ別途固定する。workerの変更差分から採点script/policyを読み込んで差し替えない。

### 4.3 通常Refineryとの差異と強制点

標準formulaには、空commandをskipする、既存失敗を記録して先へ進む、quality-reviewを測定専用・fail-openにする記述がある。これらはv2.1の合格条件ではない。[S5]

`merge_strategy=pr`、`require_review=true`、`run_tests=true`、`integration_branch_auto_land=false`を初期方針とし、対象branchはallowlistで固定する。formulaへの文章追加だけでは強制しない。

最終統合先は既存のリポジトリ保護とrequired checkを用いる。`deepflow-acceptance`がbaselineと統合後candidateを検証し、head/base/tree/policy digestへ結果を対応付ける。workerとRefineryの資格情報には保護branch直接push/bypass権限を与えない。投稿できることとrequired check結果を偽装できることも分離する。

PR headだけを検証して合格とせず、実際に統合される候補で再検証する。base更新時に古い結果を再使用できないことを負例で確認する。この強制点を用意できないlocal-only構成では、Refineryはcandidate作成までとし、自動main更新は不可。保護設定・check・独立reviewの接続は未構築/未試験のため、現時点で自動統合を有効にしない。

## 5. Session復旧方式

**v2.1の既定は「新worktree・新Sessionへ引継ぎ」。旧Sessionを別worktreeからresumeしない。**

復旧は既存Gas Townの監視・タスク管理の操作として行う。旧processの終了を確認できない場合は保留する。旧worktreeのdirty差分、branch/commit、成果物、未完了事項、試験結果を保存し、元のSessionは参照専用で残す。新worktreeのbaseを固定して回収差分を適用し、新しいSessionと専用HOME/DSH_HOMEで作業を引き継ぐ。旧起動世代と新起動世代は既存Beadのmetadata/証跡で関連付け、新task DBは作らない。

新Sessionへ旧会話の丸ごとコピーは行わず、出典付き要約と必要な成果物参照を渡す。旧workspaceの絶対path、認証、権限root、永続terminalを移植しない。

DSHのworking-directory変更は既存terminalやsandboxの権限rootを自動で移転しないため、`cwd`の変更を安全な移設とみなさない。[S6] 同一worktreeでのresumeは将来の別ゲートとし、v2.1のpresetに`resume_flag`/自動continueを登録しない。Gas Townがfresh-session handoffを正しく行うことをE2Eで確認する。

## 6. 外部送信・環境・読取り権限

### 6.1 送信経路を別々に止める

固定DSH baseにはDeepSeek Sessionログ送信が既定で有効な構成がある。これはモデル要求に添付され、gateway経由でも送られ得る。OTel設定とは別である。[S1]

最終overrideで`session-log-deepseek`の`enabled:false`と行の無効化を明示する。`session-telemetry-otel`も無効化し、環境は`DSH_TELEMETRY_MODE=DISABLED`とする。package inventory送信も無効化する。TUI既定のOTel無効化を根拠にSessionログまで停止済みとしない。[S10][S11]

### 6.2 環境のallowlist

PATH/TERM/locale/時刻関連、専用HOME/DSH_HOME、明示したworkspace、監査したGas Townのrole識別情報、選択したproviderの必要credentialだけを渡す。`GT_*`やhost全envの無条件コピーはしない。Node preload、任意proxy、別モデルprovider、汎用GitHub token、SSH agent、認証helper、ユーザー設定を暗黙に継承しない。

必要な`GT_*`/`BD_*`の名前は固定実装の起動契約から一覧化する。未確認の値を捨ててCLIを壊すことも、全件許可することも避け、allowlistが未完成なら起動ゲート未達とする。

起動ディレクトリの`.env`、DSH_HOMEの`.env`/credential、TUIの保存設定、Git設定、MCP server、plugin配置も検査する。環境を空にしただけではこれらの読込みを止めたことにならない。[S1][S9]

### 6.3 読取りと通信

読取りは割当worktree、固定の実行資材、専用Session領域、必要最小限の共有資料へ限定する。`workspace-write`はread/networkの境界ではない。Git worktreeはファイル競合の分離であり、セキュリティsandboxではない。[S1]

読取り境界は既存のOS/コンテナ/sandbox機構で強制し、Gas Town CLIが必要とするstateも最小権限で公開する。DSHの承認UIやmodel tool filterだけではshell経由を防いだことにしない。強制できない構成は公開fixture用に限定し、private repoを投入しない。

通信は許可したモデルgateway/providerと必要なGas Townサービスのみ。TUIのversion確認、OAuth探索、browser/search、MCP、OTel、Langfuseはそれぞれ個別の許可対象。`local_private`ではroot/管理役/補助LLMを含め外部fallbackなし。外部modelを明示使用するrunは、その目的と承認された入力を除外した通信ゼロを求める。

### 6.4 A10の検証

固有のcanaryを「読取り禁止file」「Sessionの非モデル可視ログ」「tool出力」「起動失敗diagnostics」へ別々に配置する。起動、通常turn、tool実行、feedback、再起動、終了で、DNS/egressと送信本文を検査する。

model endpointが許可されていても追加Sessionログが同梱される可能性があるため、host/port監視だけでは不足する。stub gatewayでbodyを検査し、通常の承認済みモデル入力と追加ログを区別する。raw Session、tool引数、秘密、絶対pathが不要な送信先へ出たらFAIL。startup diagnosticsもredaction済みと仮定しない。[S1]

## 7. Phase 0 — 作業状態の保存と旧接続の撤去

### 7.1 バックアップ

Git tagだけで未コミット変更を保存した扱いにしない。旧process/autoformatter/agent等の書込みを止め、repo外のアクセス制限した場所へ以下を保存する。

- HEAD、branch、全refs、`git status --porcelain=v2 -z`、staged/unstagedのbinary diff、Git bundle。
- untracked・必要なignoredを含む作業fileの内容、symlink、実行属性、保存対象manifestとSHA-256。
- staged状態を再現する情報。submodule・linked worktree・別gitdir/common-dirは個別に棚卸し。
- 必要なDB/volume、`.env`等の秘密を含む運用状態は別の保護されたbackup。公開artifactへ混ぜない。

保存前後のstatus/digest一致、別ディレクトリでの復元、差分と必要な未追跡fileの一致を検証する。レビューの8ファイルから件数が変化したら取り直し/照合する。ファイル名は推測しない。`git reset --hard`、`git clean`、`git stash`、強制checkoutをバックアップ代わりに実行しない。

バックアップ検証後、基準commitへのtagは任意の参照点として作る。tag自体を未コミット状態の保存証拠にしない。今回はどれも実行していない。

### 7.2 撤去台帳

| 対象 | 処置 |
|---|---|
| 旧orchestrator/deerflow/opencode/database/refinery | 接続差分を棚卸しして主経路から撤去 |
| 旧CLI | `cli.py`、entry point、既存インストール物、PATH先の実体を確認。旧CLIが残れば失敗 |
| Python | `pyproject.toml`、`uv.lock`、wheel、venv、pytest/ruff設定を依存単位で処理 |
| Compose/Docker | 旧service、healthcheck、depends_on、network/volume、Dockerfile、起動scriptを照合 |
| 環境設定 | `.env.example`/`.env.sample`、provider別YAML、旧変数、secret注入元を分類 |
| CI | setup-python/uv/build/test/runtime checker/releaseの旧起動経路を置換 |
| 運用・文書 | AGENTS/BLUEPRINT/README、runbook、license notices、配布commandを更新 |

LiteLLMが自分のPostgreSQLを必要とする場合まで無差別に削除しない。不要になった独自task DBと、残す周辺サービスのDBを区別する。旧`.env`やvolumeを一括破棄しない。

検索結果がdocumentation-onlyか実行可能な参照かを分類し、clean checkoutからのbuild/install/起動で、DeerFlow/OpenCode/旧Python CLIへ接続しないことを確認する。古いvenvやCLIがある環境では衝突を検出して停止する。[S12]

## 8. lockとフェーズの合格条件

`upstream.lock`にはDSH/rustdsh/Gas Town/TUIに加え、**外部Beads CLI、Dolt、Node、pnpm、tmux、Git、OS/architecture/libc、必要なGo build環境、container image digest、TUIの推移依存とnative資材、worker profile、formula、Acceptance、adapter**を含める。

source commit、package version、artifact digestは別項目。Git submodule/vendorも再帰的に固定する。`latest`、branch HEAD、semver rangeで本番再現性を主張しない。

付属lockは `kind=design-candidate`、`status=blocked`。TUIを含むsource候補と本書で生成したpolicy/overrideのhashだけが埋まっている。Beads/Dolt/実行環境の正確な実体・互換性・生成物は未固定。未設定を空の成功値として通さない。正確な環境は利用者の機械で未取得であり、推測して埋めない。

| Phase | 合格条件 |
|---|---|
| 0 保存 | dirty/untrackedを含む復元試験成功。旧接続台帳完成 |
| 1 依存・接続 | deployment lock完成、TUI/profile compositionとreadiness、privacy canary合格 |
| 2 スウォーム | 対象遅延投入経路でA03/A04、起動・停止・復旧試験成功 |
| 3 統合 | 逐次MRのAcceptance/PR強制ゲート合格。二分処理は対象外 |
| 4 負荷 | 4→8→16→32→100の段階試験。Polecat数とLLM同時数を別記録 |

未取得の互換証拠や失敗した必須試験を警告だけで通さない。既存部品で要求を満たせない場合は、その接続/機能の採用を保留し、第二のSchedulerを追加して帳尻を合わせない。

## 9. 出典（固定source）

[S1] DSH CLI reference（profile、外部送信、read/network、.env、diagnostics）
https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/apps/cli/reference/README.md

[S2] Gas Town Agent Provider Integration
https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/docs/agent-provider-integration.md

[S3] Scheduler dispatch
https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/internal/cmd/capacity_dispatch.go

[S4] Refinery batch（コード存在と通常経路の接続を区別）
https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/internal/refinery/batch.go

[S5] Refinery標準formula（空command、既存失敗、測定専用review）
https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/internal/formula/formulas/mol-refinery-patrol.formula.toml

[S6] DSH working-directory
https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/docs/subsystems/working-directory.md

[S7] TUI package manifest
https://github.com/ccch1mneyyy/dsh-TUI/blob/76c2a26b7f0d81e91b04c848e8aa9671f93ed046/package.json

[S8] TUI README
https://github.com/ccch1mneyyy/dsh-TUI/blob/76c2a26b7f0d81e91b04c848e8aa9671f93ed046/README.md

[S9] TUI configuration
https://github.com/ccch1mneyyy/dsh-TUI/blob/76c2a26b7f0d81e91b04c848e8aa9671f93ed046/docs/configuration.en.md

[S10] TUI bundle patch
https://github.com/ccch1mneyyy/dsh-TUI/blob/76c2a26b7f0d81e91b04c848e8aa9671f93ed046/cordis.patch.yml

[S11] DSH base bundle
https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/bundle/base/cordis.patch.yml

[S12] 現行旧Python依存・CLI entry point（レビュー時にdefault branchから取得）
https://github.com/RNA4219/deepflow-swarm/blob/main/pyproject.toml
