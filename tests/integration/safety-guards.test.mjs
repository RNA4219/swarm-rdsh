import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateOperationPermissions } from '../../tools/operation-permissions.mjs';
import { assessLoadSample, evaluateInfrastructureSmoke, schedulerDispatchPassed } from '../../tools/load-safety.mjs';

const permissions = { activeTesting: true, sharedDataDestruction: true, availabilityTesting: true };
const recovery = { backupVerified: true, restoreProcedureVerified: true,
  requiredBeforeSharedDataDestruction: true, requiredBeforeAvailabilityTesting: true };
const sample = (closed = 4) => ({ memAvailableKiB: 8 * 1024 * 1024, swapUsedKiB: 0,
  tasks: { total: 4, closed, assignees: 4 }, polecats: { total: 4 },
  tmuxPanes: 4, dshSessions: { substantiveFiles: 4 } });

test('復旧済みでも不許可の操作とactiveTesting停止を拒否する', () => {
  assert.deepEqual(evaluateOperationPermissions({ ...permissions, sharedDataDestruction: false }, recovery),
    { allowed: false, blocked: ['shared-data-destruction'] });
  assert.equal(evaluateOperationPermissions({ ...permissions, activeTesting: false }, recovery).blocked.length, 2);
});

test('不正なbooleanと復元未確認を拒否する', () => {
  assert.throws(() => evaluateOperationPermissions(permissions, { ...recovery, backupVerified: 'false' }), /must be boolean/);
  assert.throws(() => evaluateOperationPermissions({ ...permissions, availabilityTesting: 1 }, recovery), /must be boolean/);
  assert.equal(evaluateOperationPermissions(permissions, { ...recovery, restoreProcedureVerified: false }).allowed, false);
});

test('全件完了とメモリ・swap停止条件の同時成立は失敗にする', () => {
  for (const current of [ { ...sample(), memAvailableKiB: 1 }, { ...sample(), swapUsedKiB: 5 * 1024 * 1024 } ]) {
    assert.equal(assessLoadSample(current, 4).result, 'failed');
    assert.equal(evaluateInfrastructureSmoke(4, [current]).result, 'failed');
  }
});

test('監視欠落・不正な完了件数・空の証跡を合格にしない', () => {
  assert.equal(evaluateInfrastructureSmoke(4, []).result, 'failed');
  assert.equal(evaluateInfrastructureSmoke(4, [{ ...sample(), memAvailableKiB: undefined }]).result, 'failed');
  assert.equal(evaluateInfrastructureSmoke(4, [sample()], 'sampling-failed').result, 'failed');
  assert.equal(assessLoadSample({ ...sample(), tasks: { total: 4, closed: 5 } }, 4).result, 'failed');
  assert.equal(evaluateInfrastructureSmoke(4, [sample(3)]).result, 'failed');
});

test('途中の停止を後続の正常sampleで上書きせず、smokeを本番資格へ昇格しない', () => {
  assert.equal(evaluateInfrastructureSmoke(4, [{ ...sample(0), memAvailableKiB: 1 }, sample()]).result, 'failed');
  const report = evaluateInfrastructureSmoke(4, [sample(0), sample()]);
  assert.equal(report.result, 'passed');
  for (const key of ['productionQualified', 'modelCallsIndependentlyVerified',
    'simultaneousModelInflightVerified', 'artifactAcceptanceVerified']) assert.equal(report[key], false);
});

test('負荷harnessのimportだけではfixtureやschedulerを起動しない', async () => {
  await import('../../tools/qualify-load.mjs');
});

test('同時投入は一つの成功とlock拒否の組合せだけを認める', () => {
  const success = { code: 0, stdout: 'Dispatched 4, failed 0', stderr: '' };
  const locked = { code: 1, stdout: '', stderr: 'scheduler dispatch already in progress' };
  assert.equal(schedulerDispatchPassed(4, [success, locked]), true);
  assert.equal(schedulerDispatchPassed(4, [success, success]), false);
  assert.equal(schedulerDispatchPassed(4, [success, { ...locked, stderr: 'unrelated error' }]), false);
  assert.equal(schedulerDispatchPassed(4, [{ ...success, stdout: 'Dispatched 3, failed 1' }, locked]), false);
  assert.equal(schedulerDispatchPassed(4, []), false);
});
