// 操作許可と復旧確認を分離する純粋な検査。操作自体は実行しない。
export function validateOperationPermissions(authorization, recovery) {
  if (!authorization || !recovery) throw new Error('missing-operation-permissions');
  for (const key of ['activeTesting', 'sharedDataDestruction', 'availabilityTesting']) {
    if (typeof authorization[key] !== 'boolean') throw new Error(`authorization.${key} must be boolean`);
  }
  for (const key of ['backupVerified', 'restoreProcedureVerified',
    'requiredBeforeSharedDataDestruction', 'requiredBeforeAvailabilityTesting']) {
    if (typeof recovery[key] !== 'boolean') throw new Error(`recovery.${key} must be boolean`);
  }
}

export function evaluateOperationPermissions(authorization, recovery) {
  validateOperationPermissions(authorization, recovery);
  const blocked = [];
  const restored = recovery.backupVerified === true && recovery.restoreProcedureVerified === true;
  for (const [operation, permission, needsRecovery] of [
    ['shared-data-destruction', 'sharedDataDestruction', 'requiredBeforeSharedDataDestruction'],
    ['availability-testing', 'availabilityTesting', 'requiredBeforeAvailabilityTesting'],
  ]) {
    if (authorization.activeTesting !== true || authorization[permission] !== true
      || (recovery[needsRecovery] === true && !restored)) blocked.push(operation);
  }
  return { allowed: blocked.length === 0, blocked };
}
