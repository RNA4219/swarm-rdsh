// 資格記録の読み取り専用診断。実行、配布、資格の発行やlockの更新は行わない。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIREMENTS = {
  'os-image-architecture-libc': 'OSイメージ・アーキテクチャ・libcと可搬配布の固定',
  'tui-transitive-lock-and-native-assets': 'TUIの推移依存・native資材・ライセンスの固定',
  'effective-worker-profile': '実効toolの確認とprivate環境の境界試験',
  'trusted-acceptance-lock': '保護された統合経路でのAcceptance証跡',
  'resolved-formula': '永続工程のMolecule契約試験',
  'role-env-allowlist': '全管理役の環境変数・実行契約試験',
  'model-route-configuration': 'モデル階層と全役割の接続試験',
  'formal-dsh-tui-compatibility': '固定DSHとTUIの正式互換性',
  'nudge-terminal-contract': '通常nudgeの入力受付・応答照合',
  'automatic-recovery': 'Witness・Deaconによる自動復旧試験',
  'refinery-protected-merge': '保護PRでのRefinery統合試験',
  'private-privacy-canary': '禁止領域と全lifecycle通信のcanary試験',
};
const QUALIFICATIONS = ['build', 'profile_composition', 'privacy_canary', 'pty_e2e'];
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function inspectQualification(lock) {
  if (!isObject(lock)) throw new Error('invalid-qualification-record');
  const findings = [];
  const add = (id, category, reason) => findings.push({ id, category, reason });
  const candidate = lock.kind === 'design-candidate-not-deployment';
  if (lock.kind !== 'deployment' || lock.status !== 'ready' || lock.unresolved_action === 'reject-deployment') {
    add('deployment-record', 'missing-qualification', candidate
      ? '設計候補の記録であり、本番deploymentの資格を持たない'
      : '通常アダプターのdeployment契約を満たしていない');
  }
  const unresolved = lock.required_unresolved;
  if (!Array.isArray(unresolved)) {
    add('required-unresolved', 'invalid-record', '必須要件の記録が欠落または不正');
  } else {
    unresolved.forEach((entry, index) => {
      const name = isObject(entry) && Object.hasOwn(REQUIREMENTS, entry.name) ? entry.name : null;
      add(name ?? `unknown-requirement-${index + 1}`, 'missing-verification',
        name ? REQUIREMENTS[name] : '未解決要件の識別子が未対応または不正');
    });
  }
  const qualifications = isObject(lock.qualification) ? lock.qualification : {};
  const launchClaims = Object.fromEntries(QUALIFICATIONS.map((name) => {
    const claimPresent = qualifications[name] === 'passed';
    if (!claimPresent) add(`qualification-${name}`, 'missing-qualification', `${name}の通常実行資格が不足`);
    return [name, claimPresent];
  }));
  const e2e = isObject(lock.real_e2e) ? lock.real_e2e : {};
  const synthetic = e2e.scope === 'synthetic-public-fixture';
  if (e2e.production_qualified !== true) {
    add('production-e2e', 'missing-verification', '本番E2Eの資格記録がない');
  } else if (synthetic || e2e.scope !== 'production') {
    add('production-e2e-scope', 'contradictory-evidence', '本番資格の宣言とE2E証跡の範囲が一致しない');
  } else {
    add('production-e2e-receipt', 'review-required', '本検査は本番サービスの証跡を独立検証していない');
  }
  const load = isObject(lock.public_load_qualification) ? lock.public_load_qualification : {};
  const nodes = load.recorded_nodes ?? load.qualified_nodes;
  const boundedNodes = Number.isSafeInteger(nodes) && nodes >= 1 && nodes <= 100 ? nodes : null;
  return {
    schema: 'swarm-rdsh-qualification-inspection/v1',
    mode: 'read-only',
    qualificationIssued: false,
    outcome: findings.some((entry) => entry.category !== 'review-required') ? 'blocked' : 'review-required',
    deployment: { designCandidate: candidate, unresolvedCount: Array.isArray(unresolved) ? unresolved.length : null,
      launchClaims },
    productionE2e: { claimPresent: e2e.production_qualified === true,
      evidenceScope: synthetic ? 'synthetic-public-fixture' : e2e.scope === 'production' ? 'production' : 'unknown',
      independentlyVerified: false },
    load: { evidenceScope: ['synthetic-public-fixture', 'synthetic-infrastructure-smoke'].includes(load.scope) ? load.scope : 'unknown',
      recordedNodes: boundedNodes, load16Claim: qualifications.load_16 === 'passed',
      load32Claim: qualifications.load_32 === 'passed', concurrentDispatchClaim: qualifications.concurrent_dispatch === 'passed',
      infrastructureSmoke16Claim: qualifications.load_16 === 'passed-infrastructure-smoke',
      infrastructureSmoke32Claim: qualifications.load_32 === 'passed-infrastructure-smoke',
      establishesProductionQualification: false },
    findings,
  };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args[0]?.startsWith('--')) throw new Error('usage: inspect-qualification.mjs [lock-path]');
    const path = args.length ? resolve(args[0]) : fileURLToPath(new URL('../upstream.lock', import.meta.url));
    const report = inspectQualification(JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
  } catch {
    console.error('qualification-inspection-failed: 資格記録または引数が不正です');
    process.exitCode = 3;
  }
}
