import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { inspectQualification } from '../../tools/inspect-qualification.mjs';
import { fixture } from '../helpers.mjs';

test('合成32ノードの合格を本番資格へ昇格しない', () => {
  const report = inspectQualification({ kind: 'design-candidate-not-deployment', status: 'blocked',
    required_unresolved: [{ name: 'private-privacy-canary' }],
    qualification: { load_32: 'passed', concurrent_dispatch: 'passed' },
    real_e2e: { scope: 'synthetic-public-fixture', production_qualified: false },
    public_load_qualification: { scope: 'synthetic-public-fixture', qualified_nodes: 32 } });
  assert.equal(report.outcome, 'blocked');
  assert.equal(report.load.recordedNodes, 32);
  assert.equal(report.load.establishesProductionQualification, false);
  assert.equal(report.qualificationIssued, false);
  assert.ok(report.findings.some((entry) => entry.id === 'private-privacy-canary'));
});

test('booleanの手動変更と合成E2Eの本番偽装を診断する', () => {
  const report = inspectQualification({ kind: 'deployment', status: 'ready', required_unresolved: [],
    qualification: { build: 'passed', profile_composition: 'passed', privacy_canary: 'passed', pty_e2e: 'passed' },
    real_e2e: { scope: 'synthetic-public-fixture', production_qualified: true } });
  assert.equal(report.outcome, 'blocked');
  assert.ok(report.findings.some((entry) => entry.id === 'production-e2e-scope'));
  assert.equal(report.qualificationIssued, false);
});

test('欠落記録を合格にせず、未知fieldや自由文に含む秘密を転記しない', () => {
  const secret = 'private-synthetic-inspection-value';
  const report = inspectQualification({ kind: secret, status: secret, credentials: { token: secret },
    real_e2e: { scope: secret, evidence: secret }, required_unresolved: [{ name: secret, status: secret }] });
  assert.equal(report.outcome, 'blocked');
  assert.ok(!JSON.stringify(report).includes(secret));
  const malformed = inspectQualification({ required_unresolved: null });
  assert.equal(malformed.deployment.unresolvedCount, null);
  assert.ok(malformed.findings.some((entry) => entry.id === 'required-unresolved'));
  assert.throws(() => inspectQualification([]), /invalid-qualification-record/);
});

test('CLIの診断は入力lockを変更せず、blockedを非zeroで返す', (t) => {
  const f = fixture(t);
  const path = join(f.root, 'inspection.lock');
  writeFileSync(path, JSON.stringify({ kind: 'design-candidate-not-deployment', status: 'blocked', required_unresolved: [] }));
  const before = readFileSync(path);
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../../tools/inspect-qualification.mjs'), path], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).qualificationIssued, false);
  assert.deepEqual(readFileSync(path), before);
});

test('本番資格の宣言が揃っても、読み取り検査で資格を発行しない', () => {
  const report = inspectQualification({ kind: 'deployment', status: 'ready', required_unresolved: [],
    qualification: { build: 'passed', profile_composition: 'passed', privacy_canary: 'passed', pty_e2e: 'passed' },
    real_e2e: { scope: 'production', production_qualified: true } });
  assert.equal(report.outcome, 'review-required');
  assert.equal(report.productionE2e.independentlyVerified, false);
  assert.equal(report.qualificationIssued, false);
});

test('不正なJSONの本文をエラーへ転記しない', (t) => {
  const f = fixture(t);
  const path = join(f.root, 'invalid-inspection.lock');
  const secret = 'private-synthetic-invalid-json-value';
  writeFileSync(path, `{"secret":"${secret}" invalid`);
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../../tools/inspect-qualification.mjs'), path], { encoding: 'utf8' });
  assert.equal(result.status, 3);
  assert.equal(result.stdout, '');
  assert.ok(!result.stderr.includes(secret));
});

test('infrastructure smokeの件数と、本番向けload資格を区別する', () => {
  const report = inspectQualification({ kind: 'design-candidate-not-deployment', status: 'blocked',
    required_unresolved: [], qualification: { load_32: 'passed-infrastructure-smoke' },
    public_load_qualification: { scope: 'synthetic-infrastructure-smoke', recorded_nodes: 32 } });
  assert.equal(report.load.recordedNodes, 32);
  assert.equal(report.load.infrastructureSmoke32Claim, true);
  assert.equal(report.load.load32Claim, false);
  assert.equal(report.load.establishesProductionQualification, false);
});
