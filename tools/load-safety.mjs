const THRESHOLD_KIB = 4 * 1024 * 1024;
const count = (value) => Number.isSafeInteger(value) && value >= 0;

export function resourceStopReason(sample) {
  if (!sample || !Number.isFinite(sample.memAvailableKiB) || sample.memAvailableKiB < 0
    || !Number.isFinite(sample.swapUsedKiB) || sample.swapUsedKiB < 0) return 'resource-evidence-missing';
  if (sample.memAvailableKiB < THRESHOLD_KIB) return 'available-memory-below-4-GiB';
  if (sample.swapUsedKiB > THRESHOLD_KIB) return 'swap-use-above-4-GiB';
  return null;
}

export function schedulerDispatchPassed(stage, results) {
  if (!Number.isSafeInteger(stage) || stage < 1 || stage > 100 || !Array.isArray(results) || results.length !== 2) return false;
  const successes = results.filter((result) => result?.code === 0 && typeof result.stdout === 'string');
  const rejections = results.filter((result) => result?.code === 1 && typeof result.stderr === 'string'
    && result.stderr.includes('scheduler dispatch already in progress'));
  return successes.length === 1 && rejections.length === 1
    && new RegExp(`Dispatched\\s+${stage}\\b[^\\n]*failed\\s+0\\b`, 'iu').test(successes[0].stdout);
}

export function assessLoadSample(sample, stage) {
  const stopReason = resourceStopReason(sample);
  if (stopReason) return { result: 'failed', stopReason };
  if (!Number.isSafeInteger(stage) || stage < 1 || stage > 100 || !sample.tasks
    || !count(sample.tasks.total) || !count(sample.tasks.closed)
    || sample.tasks.total !== stage || sample.tasks.closed > sample.tasks.total) {
    return { result: 'failed', stopReason: 'task-evidence-invalid' };
  }
  return { result: sample.tasks.closed === stage ? 'passed' : 'running', stopReason: null };
}

export function evaluateInfrastructureSmoke(stage, samples, priorStopReason = null) {
  let stopReason = priorStopReason;
  if (!Array.isArray(samples) || !samples.length) stopReason ||= 'samples-missing';
  const safeSamples = Array.isArray(samples) ? samples : [];
  for (const sample of safeSamples) {
    const assessment = assessLoadSample(sample, stage);
    if (assessment.result === 'failed') stopReason ||= assessment.stopReason;
    if (![sample?.polecats?.total, sample?.tmuxPanes, sample?.dshSessions?.substantiveFiles,
      sample?.tasks?.assignees].every(count)) stopReason ||= 'concurrency-evidence-invalid';
  }
  const peak = (get) => Math.max(0, ...safeSamples.map((sample) => count(get(sample)) ? get(sample) : 0));
  const maxPolecats = peak((sample) => sample?.polecats?.total);
  const maxTmuxPanes = peak((sample) => sample?.tmuxPanes);
  const maxSubstantiveSessions = peak((sample) => sample?.dshSessions?.substantiveFiles);
  const final = safeSamples.at(-1);
  if (!stopReason && (final?.tasks?.closed !== stage || final?.tasks?.assignees < stage
    || maxPolecats < stage || maxTmuxPanes < stage || maxSubstantiveSessions < stage)) {
    stopReason = 'infrastructure-evidence-incomplete';
  }
  return { result: stopReason ? 'failed' : 'passed', stopReason, maxPolecats, maxTmuxPanes,
    maxSubstantiveSessions, qualificationScope: 'synthetic-infrastructure-smoke',
    productionQualified: false, modelCallsIndependentlyVerified: false,
    simultaneousModelInflightVerified: false, artifactAcceptanceVerified: false };
}
