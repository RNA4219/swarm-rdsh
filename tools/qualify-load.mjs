#!/usr/bin/env node
// Gas Townの既存schedulerだけを使う段階負荷fixture。実ターゲット通信は行わない。
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync,
  statSync, symlinkSync, writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessLoadSample, evaluateInfrastructureSmoke, resourceStopReason, schedulerDispatchPassed } from "./load-safety.mjs";

const STAGES = [4, 8, 16, 32, 100];
const WAIT_SECONDS = new Map([[4, 30], [8, 45], [16, 150], [32, 300], [100, 750]]);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prefix = "/home/ryo-n/.local/share/deepflow-swarm";
const qualificationRoot = join(prefix, "qualification-load-20261013");
const dshSource = join(prefix, "sources/dsh-d743267388641bc76f17c45ce8b4c231aed1d32c");
const tuiSource = join(prefix, "sources/dsh-tui-76c2a26b7f0d81e91b04c848e8aa9671f93ed046");
const node = join(prefix, "node-v24.15.0-linux-x64/bin/node");
const rigName = "fixture";

function stageNumber(value) {
  const stage = Number(value);
  if (!STAGES.includes(stage)) throw new Error(`stage must be one of ${STAGES.join(", ")}`);
  return stage;
}

function locations(stage) {
  const root = join(qualificationRoot, `stage-${stage}`);
  return {
    root,
    town: join(root, "town"),
    rig: join(root, `town/${rigName}`),
    evidence: join(root, "evidence"),
    state: join(root, "stage-state.json"),
    tasks: join(root, "tasks.json"),
    env: join(root, "controller-env.json"),
    dshHome: join(root, "dsh-home")
  };
}

function json(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function townSocketName(townPath) {
  const suffix = createHash("sha256").update(townPath).digest("hex").slice(0, 6);
  return `town-${suffix}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function controller(stage) {
  const paths = locations(stage);
  return { paths, env: readJson(paths.env) };
}

function run(stage, name, args, cwd = locations(stage).town, timeout = 120_000) {
  const { env } = controller(stage);
  return execFileSync(join(prefix, "bin", name), args, {
    cwd, env, encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"]
  });
}

function previousStage(stage) {
  return STAGES[STAGES.indexOf(stage) - 1] ?? null;
}

function requirePriorPass(stage) {
  const prior = previousStage(stage);
  if (!prior) return;
  const priorSummary = join(locations(prior).evidence, `stage-${prior}-summary.json`);
  if (!existsSync(priorSummary) || readJson(priorSummary).result !== "passed") {
    throw new Error(`stage ${prior} must pass before stage ${stage}`);
  }
}

function setup(stage) {
  requirePriorPass(stage);
  const paths = locations(stage);
  if (existsSync(paths.root)) throw new Error(`refusing existing fixture: ${paths.root}`);
  const controllerHome = join(paths.root, "controller-home");
  const workerHome = join(paths.root, "worker-home");
  const profile = join(paths.dshHome, "profiles/deepflow-worker-v2_1");
  const wrapperDir = join(paths.root, "bin");
  const workerHomes = join(paths.root, "worker-homes");
  for (const path of [controllerHome, workerHome, workerHomes, profile, wrapperDir, join(paths.root, "tmux"), paths.evidence]) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
  json(join(paths.root, "PUBLIC_FIXTURE.json"), {
    scope: "synthetic-public-fixture",
    purpose: "staged-load-qualification",
    stage,
    targetTraffic: false,
    modelCalls: "real-fixed-route"
  });
  writeFileSync(join(controllerHome, ".gitconfig"),
    "[user]\n name = DeepFlow Load Fixture\n email = load-fixture@example.invalid\n");
  const env = {
    HOME: controllerHome,
    PATH: [dirname(node), join(prefix, "bin"), "/usr/bin", "/bin"].join(":"),
    LANG: "C.UTF-8",
    TMUX_TMPDIR: join(paths.root, "tmux"),
    GT_TMUX_SOCKET: townSocketName(paths.town),
    GT_DEBUG_SESSION: "1",
    GIT_AUTHOR_NAME: "DeepFlow Load Fixture",
    GIT_AUTHOR_EMAIL: "load-fixture@example.invalid",
    GIT_COMMITTER_NAME: "DeepFlow Load Fixture",
    GIT_COMMITTER_EMAIL: "load-fixture@example.invalid"
  };
  json(paths.env, env);
  for (const home of [controllerHome, workerHome]) {
    execFileSync(join(prefix, "bin/dolt"), ["config", "--global", "--add", "versioncheck.disabled", "true"], {
      env, cwd: home, stdio: "ignore"
    });
  }

  const seed = join(paths.root, "seed");
  mkdirSync(join(seed, "results"), { recursive: true });
  writeFileSync(join(seed, "results/.gitkeep"), "");
  writeFileSync(join(seed, "verify-result.mjs"), [
    "import { strict as assert } from 'node:assert';",
    "import { readFileSync } from 'node:fs';",
    "const [path, expected] = process.argv.slice(2);",
    "assert.equal(readFileSync(path, 'utf8'), `${expected}\\n`);",
    "console.log('LOAD_ACCEPTANCE_OK');",
    ""
  ].join("\n"));
  writeFileSync(join(seed, "AGENTS.md"), [
    "# Synthetic load qualification fixture",
    "Perform only the assigned deterministic file task.",
    "Do not inspect environment variables, credentials, or unrelated files.",
    "Do not access the penetration-test target or any external site.",
    "Run the specified acceptance command, commit only the assigned result file, then call `gt done`.",
    ""
  ].join("\n"));
  execFileSync("git", ["init", "-q", "-b", "main", seed], { env });
  execFileSync("git", ["add", "."], { cwd: seed, env });
  execFileSync("git", ["commit", "-qm", "Synthetic load fixture"], { cwd: seed, env });
  execFileSync("git", ["clone", "-q", "--bare", seed, join(paths.root, "origin.git")], { env });

  copyFileSync(join(repo, "config/dsh/worker-profile/cordis.patch.yml"), join(profile, "cordis.patch.yml"));
  copyFileSync(join(repo, "config/dsh/worker-profile/fixture-only.patch.yml"), join(paths.dshHome, "fixture-only.patch.yml"));
  writeFileSync(join(paths.dshHome, "cordis.patch.yml"), "# Machine layer intentionally empty.\n[]\n");
  json(join(profile, "package.json"), {
    name: "deepflow-worker-v2_1", private: true, type: "module",
    dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-harness-tui/dsh-tui"] } }
  });
  const modules = join(profile, "node_modules");
  mkdirSync(modules, { recursive: true });
  const candidates = [];
  for (const parent of ["packages", "vendor", "apps", "native/system/packages"]) {
    const directory = join(dshSource, parent);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const first = join(directory, entry.name);
      if (existsSync(join(first, "package.json"))) candidates.push(first);
      else {
        for (const child of readdirSync(first, { withFileTypes: true })) {
          if (child.isDirectory() && existsSync(join(first, child.name, "package.json"))) {
            candidates.push(join(first, child.name));
          }
        }
      }
    }
  }
  for (const source of [...candidates, tuiSource]) {
    const manifest = readJson(join(source, "package.json"));
    if (!manifest.name?.startsWith("@deepseek-")) continue;
    const target = join(modules, manifest.name);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) symlinkSync(source, target, "dir");
  }

  const dshBin = join(prefix, "bin/dsh");
  if (!existsSync(dshBin)) symlinkSync(join(dshSource, "apps/cli/lib/bin.js"), dshBin);
  const wrapper = join(wrapperDir, "gt-dsh-load");
  const hookAdapter = join(wrapperDir, "qualify-load-hook.mjs");
  const supervisorWrapper = join(wrapperDir, "gt-load-supervisor");
  writeFileSync(hookAdapter, [
    "import { execFileSync, spawnSync } from 'node:child_process';",
    "const [gtBin, nodeBin, worker, config, envFile, prompt, ...extra] = process.argv.slice(2);",
    "if (extra.length || !prompt) throw new Error('invalid-load-hook-arguments');",
    "const prime = execFileSync(gtBin, ['prime', '--hook'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });",
    "const result = spawnSync(nodeBin, [worker, config, envFile, `${prompt}\\n\\n${prime}`], { stdio: 'inherit' });",
    "if (result.error) throw result.error;",
    "if (result.signal) process.kill(process.pid, result.signal);",
    "process.exit(result.status ?? 1);",
    ""
  ].join("\n"));
  writeFileSync(wrapper, [
    "#!/bin/sh",
    `printf '%s cwd=%s argc=%s\\n' "$(date -u +%FT%TZ)" "$PWD" "$#" >> '${join(paths.evidence, "wrapper-invocations.log")}'`,
    "printf '%s\\n' 'dsh fixture ready >'",
    `exec '${node}' '${hookAdapter}' '${join(prefix, "bin/gt")}' '${node}' '${join(repo, "tools/qualify-worker.mjs")}' '${join(paths.root, "worker-config.json")}' '${join(repo, ".env.deepinfra.local")}' "$@" 2>> '${join(paths.evidence, "wrapper-stderr.log")}'`,
    ""
  ].join("\n"));
  chmodSync(wrapper, 0o755);
  writeFileSync(supervisorWrapper, [
    "#!/bin/sh",
    `printf '%s role=%s\\n' "$(date -u +%FT%TZ)" "\${GT_ROLE:-unknown}" >> '${join(paths.evidence, "supervisor-invocations.log")}'`,
    "printf '%s\\n' 'load supervisor ready >'",
    `'${join(prefix, "bin/gt")}' prime --hook >> '${join(paths.evidence, "supervisor-prime.log")}' 2>&1 || exit $?`,
    "exec tail -f /dev/null",
    ""
  ].join("\n"));
  chmodSync(supervisorWrapper, 0o755);
  const modelRoute = {
    provider: "deepinfra",
    id: "deepseek-ai/DeepSeek-V4.1-Flash",
    endpoint: "https://api.deepinfra.com/v1/openai",
    api_key_env: "DEEPINFRA_API_KEY"
  };
  const artifacts = {};
  for (const [name, path] of Object.entries({
    node, dsh: dshBin, rdsh: join(prefix, "bin/rdsh"), gt: join(prefix, "bin/gt"),
    bd: join(prefix, "bin/bd"), dolt: join(prefix, "bin/dolt"), bwrap: "/usr/bin/bwrap"
  })) {
    artifacts[name] = { path, sha256: hash(path), ...(name === "node" ? { version: "24.15.0" } : {}) };
  }
  const profileFiles = {};
  for (const name of [
    "profiles/deepflow-worker-v2_1/package.json",
    "profiles/deepflow-worker-v2_1/cordis.patch.yml",
    "cordis.patch.yml",
    "fixture-only.patch.yml"
  ]) profileFiles[name] = hash(join(paths.dshHome, name));
  json(join(paths.root, "fixture.lock.json"), {
    kind: "qualification-fixture",
    status: "testing",
    required_unresolved: ["production-compatibility", "private-privacy-canary"],
    source_candidates: Object.entries({
      gastown: "649b832b7672bc7a2dbef26f5983aba6198b819b",
      dsh: "d743267388641bc76f17c45ce8b4c231aed1d32c",
      rustdsh: "a1be438e232278add3ee130e7d77aaa02f9f68c5",
      "dsh-tui": "76c2a26b7f0d81e91b04c848e8aa9671f93ed046"
    }).map(([name, commit]) => ({ name, commit })),
    model_route: modelRoute,
    runtime_artifacts: artifacts,
    profile_files: profileFiles,
    execution_boundary: {
      fixture_root: paths.root,
      runtime_root: prefix,
      marker_sha256: hash(join(paths.root, "PUBLIC_FIXTURE.json")),
      mechanism: "bubblewrap",
      worker_home_mode: "per-polecat",
      worker_home_root: workerHomes,
      production_qualified: false
    },
    qualification: {
      build: "passed",
      profile_composition: "static-verified",
      staged_load: "running",
      target: stage,
      production_qualified: false
    }
  });
  json(join(paths.root, "worker-config.json"), {
    version: 1,
    profile: "deepflow-worker-v2_1",
    runtime: {
      rdsh_bin: join(prefix, "bin/rdsh"),
      dsh_bin: dshBin,
      dsh_home: paths.dshHome,
      worker_home: workerHome,
      deployment_lock: join(paths.root, "fixture.lock.json"),
      path: [dirname(node), join(prefix, "bin"), "/usr/bin", "/bin"]
    },
    model: modelRoute
  });

  mkdirSync(qualificationRoot, { recursive: true, mode: 0o700 });
  writeFileSync(join(paths.evidence, "town-install.log"), execFileSync(join(prefix, "bin/gt"), [
    "install", paths.town, "--name", `deepflow-load-${stage}`,
    "--owner", "load-fixture@example.invalid", "--dolt-port", String(14_000 + stage)
  ], { env, cwd: paths.root, encoding: "utf8", timeout: 120_000 }));
  writeFileSync(join(paths.evidence, "rig-add.log"), execFileSync(join(prefix, "bin/gt"), [
    "rig", "add", rigName, `file://${join(paths.root, "origin.git")}`, "--branch", "main", "--prefix", "ld"
  ], { env, cwd: paths.town, encoding: "utf8", timeout: 120_000 }));
  writeFileSync(join(paths.evidence, "rig-max-polecats.log"),
    run(stage, "gt", ["rig", "config", "set", rigName, "max_polecats", String(stage)]));
  const rigConfigPath = join(paths.rig, "config.json");
  const rigConfig = readJson(rigConfigPath);
  const polecatNames = Array.from({ length: stage }, (_, index) =>
    `load-${String(index + 1).padStart(3, "0")}`);
  rigConfig.polecat_names = polecatNames;
  rigConfig.max_polecats = stage;
  json(rigConfigPath, rigConfig);
  const rigSettingsPath = join(paths.rig, "settings/config.json");
  const rigSettings = readJson(rigSettingsPath);
  rigSettings.namepool = {
    ...(rigSettings.namepool ?? {}),
    style: "",
    names: polecatNames,
    max_before_numbering: stage
  };
  json(rigSettingsPath, rigSettings);
  json(join(paths.town, "settings/agents.json"), {
    version: 1,
    agents: {
      "dsh-worker": {
        name: "dsh-worker", command: wrapper, args: [], prompt_mode: "arg",
        supports_hooks: true, hooks_provider: "claude", hooks_dir: ".claude",
        hooks_settings_file: "settings.json", hooks_informational: false,
        hooks_use_settings_dir: true,
        process_names: ["bwrap", "MainThread", "rdsh", "node"],
        instructions_file: "AGENTS.md", ready_delay_ms: 100,
        escape_cancels_request: true
      },
      "load-supervisor": {
        name: "load-supervisor", command: supervisorWrapper, args: [], prompt_mode: "arg",
        supports_hooks: true, hooks_provider: "claude", hooks_dir: ".claude",
        hooks_settings_file: "settings.json", hooks_informational: false,
        hooks_use_settings_dir: true,
        process_names: ["tail"], instructions_file: "AGENTS.md",
        ready_prompt_prefix: "load supervisor ready >", ready_delay_ms: 100,
        escape_cancels_request: true
      }
    }
  });
  run(stage, "gt", ["config", "set", "default_agent", "dsh-worker"]);
  run(stage, "gt", ["config", "set", "scheduler.max_polecats", String(stage)]);
  const townSettingsPath = join(paths.town, "settings/config.json");
  const townSettings = readJson(townSettingsPath);
  townSettings.operational = {
    ...(townSettings.operational ?? {}),
    session: {
      ...(townSettings.operational?.session ?? {}),
      startup_nudge_verify_delay: "100ms",
      startup_nudge_max_retries: 0
    }
  };
  townSettings.role_agents = {
    ...(townSettings.role_agents ?? {}),
    witness: "load-supervisor",
    refinery: "load-supervisor"
  };
  json(townSettingsPath, townSettings);
  const exclude = join(paths.town, `${rigName}/.repo.git/info/exclude`);
  writeFileSync(exclude, `${readFileSync(exclude, "utf8")}\n# Gas Town fixture scaffolding\n/.beads/\n/.runtime/\n/CLAUDE.md\n`);
  const beadDir = join(paths.rig, ".beads");
  if (existsSync(beadDir)) chmodSync(beadDir, 0o700);
  execFileSync(dshBin, [
    "plugin", "--profile", "deepflow-worker-v2_1", "allow-version",
    "@deepseek-harness-tui/dsh-tui@0.14.0", "--dsh-version", "0.2.1-alpha.2", "--accept-risk"
  ], { env: { ...env, DSH_HOME: paths.dshHome }, encoding: "utf8", timeout: 30_000 });
  json(paths.state, { stage, phase: "setup", createdAt: new Date().toISOString() });
  console.log(JSON.stringify({ stage, root: paths.root, phase: "setup" }));
}

function prepare(stage) {
  requirePriorPass(stage);
  const { paths } = controller(stage);
  const state = readJson(paths.state);
  if (state.phase !== "setup") throw new Error(`expected setup phase, got ${state.phase}`);
  const waitSeconds = WAIT_SECONDS.get(stage);
  const tasks = [];
  for (let index = 1; index <= stage; index += 1) {
    const suffix = String(index).padStart(3, "0");
    const resultPath = `results/stage-${stage}-node-${suffix}.txt`;
    const token = createHash("sha256").update(`deepflow-load:${stage}:${index}`).digest("hex").slice(0, 24);
    const description = [
      "This is a synthetic infrastructure load fixture with deterministic local file tasks.",
      "Do not access any external target or unrelated site.",
      `First run sleep ${waitSeconds} exactly once so all stage-${stage} workers overlap.`,
      `Then create ${resultPath} with exactly this line: ${token}`,
      `Run node verify-result.mjs ${resultPath} ${token} and require LOAD_ACCEPTANCE_OK.`,
      "Commit only the assigned result file, then run gt done. Do not merge main."
    ].join(" ");
    const id = run(stage, "bd", [
      "create", `Load qualification stage ${stage} node ${suffix}`,
      "--type", "task", "--priority", "2", "--description", description, "--silent"
    ], paths.rig).trim();
    tasks.push({ index, id, resultPath, token });
  }
  json(paths.tasks, { stage, waitSeconds, tasks });
  json(paths.state, { ...state, phase: "prepared", preparedAt: new Date().toISOString(), taskCount: tasks.length });
  console.log(JSON.stringify({ stage, phase: "prepared", taskCount: tasks.length }));
}

function queue(stage) {
  const { paths } = controller(stage);
  const state = readJson(paths.state);
  if (state.phase !== "prepared") throw new Error(`expected prepared phase, got ${state.phase}`);
  const taskSet = readJson(paths.tasks);
  const transcript = [];
  for (const task of taskSet.tasks) {
    transcript.push(run(stage, "gt", [
      "sling", task.id, rigName, "--agent", "dsh-worker", "--hook-raw-bead",
      "--no-boot", "--owned", "--no-merge", "--no-convoy"
    ]));
  }
  writeFileSync(join(paths.evidence, `stage-${stage}-queue.log`), transcript.join("\n"));
  const scheduled = run(stage, "gt", ["scheduler", "list", "--json"]);
  writeFileSync(join(paths.evidence, `stage-${stage}-scheduled.json`), scheduled);
  json(paths.state, { ...state, phase: "queued", queuedAt: new Date().toISOString() });
  console.log(JSON.stringify({ stage, phase: "queued", taskCount: taskSet.tasks.length }));
}

function spawnScheduler(stage) {
  const { paths, env } = controller(stage);
  const binary = join(prefix, "bin/gt");
  const child = spawn(binary, ["scheduler", "run", "--batch", String(stage)], {
      cwd: paths.town, env, stdio: ["ignore", "pipe", "pipe"]
  });
  const result = new Promise((complete) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => complete({ code: null, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", code => complete({ code, stdout, stderr }));
  });
  return { child, result };
}

function ensureTmuxServer(stage) {
  const { paths, env } = controller(stage);
  const session = `deepflow-load-${stage}-keeper`;
  const socketArgs = ["-L", env.GT_TMUX_SOCKET];
  try {
    execFileSync("tmux", [...socketArgs, "has-session", "-t", session], {
      cwd: paths.town, env, stdio: ["ignore", "ignore", "ignore"], timeout: 10_000
    });
  } catch {
    execFileSync("tmux", [...socketArgs, "new-session", "-d", "-s", session, "sleep", "86400"], {
      cwd: paths.town, env, stdio: ["ignore", "ignore", "pipe"], timeout: 10_000
    });
  }
}

async function dispatch(stage) {
  const { paths } = controller(stage);
  const state = readJson(paths.state);
  if (state.phase !== "queued") throw new Error(`expected queued phase, got ${state.phase}`);
  ensureTmuxServer(stage);
  const startedAt = new Date().toISOString();
  json(paths.state, { ...state, phase: "dispatching", dispatchStartedAt: startedAt });
  const schedulers = [spawnScheduler(stage), spawnScheduler(stage)];
  const allResults = Promise.all(schedulers.map(scheduler => scheduler.result));
  let dispatchComplete = false;
  allResults.finally(() => { dispatchComplete = true; });
  const dispatchSamples = [];
  let safetyStopReason = null;
  let stopTimer;
  const stopDispatch = () => {
    if (stopTimer) return;
    for (const scheduler of schedulers) scheduler.child.kill("SIGTERM");
    stopTimer = setTimeout(() => {
      for (const scheduler of schedulers) {
        if (scheduler.child.exitCode === null && scheduler.child.signalCode === null) scheduler.child.kill("SIGKILL");
      }
    }, 5000);
    emergencyStop(stage, safetyStopReason);
  };
  while (!dispatchComplete) {
    try {
      const current = sample(stage);
      dispatchSamples.push(current);
      writeFileSync(join(paths.evidence, `stage-${stage}-dispatch-samples.jsonl`),
        `${dispatchSamples.map(value => JSON.stringify(value)).join("\n")}\n`);
      safetyStopReason = resourceStopReason(current);
      if (safetyStopReason) {
        stopDispatch();
        break;
      }
    } catch (error) {
      safetyStopReason = "sampling-failed";
      stopDispatch();
      try {
        writeFileSync(join(paths.evidence, `stage-${stage}-dispatch-sample-error.log`),
          `${new Date().toISOString()} ${error instanceof Error ? error.message : String(error)}\n`, { flag: "a" });
      } catch { /* 監視・記録の失敗でも停止判定を維持する。 */ }
      break;
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 1000));
  }
  const results = await allResults;
  if (stopTimer) clearTimeout(stopTimer);
  const concurrentDispatchVerdict = schedulerDispatchPassed(stage, results) ? "passed" : "failed";
  json(join(paths.evidence, `stage-${stage}-concurrent-dispatch.json`), {
    startedAt, concurrentDispatchVerdict, safetyStopReason, results
  });
  if (safetyStopReason) {
    json(paths.state, { ...state, phase: "failed", finishedAt: new Date().toISOString(), stopReason: safetyStopReason });
    throw new Error(`dispatch safety stop: ${safetyStopReason}`);
  }
  if (concurrentDispatchVerdict !== "passed") {
    emergencyStop(stage, "concurrent-dispatch-evidence-failed");
    json(paths.state, { ...state, phase: "failed", finishedAt: new Date().toISOString(), stopReason: "concurrent-dispatch-evidence-failed" });
    throw new Error("concurrent scheduler lock behavior failed");
  }
  json(paths.state, { ...state, phase: "dispatched", dispatchedAt: startedAt });
  console.log(JSON.stringify({
    stage, phase: "dispatched", concurrentDispatchVerdict,
    schedulerRuns: results.map(result => result.code)
  }));
}

function listTasks(stage) {
  const { paths } = controller(stage);
  const all = JSON.parse(run(stage, "bd", ["list", "--all", "--limit", "0", "--json"], paths.rig));
  return all.filter(issue => issue.title?.startsWith(`Load qualification stage ${stage} node `));
}

function listPolecats(stage) {
  const raw = JSON.parse(run(stage, "gt", ["polecat", "list", rigName, "--json"]));
  return Array.isArray(raw) ? raw : raw.polecats ?? [];
}

function memorySnapshot() {
  const values = {};
  for (const line of readFileSync("/proc/meminfo", "utf8").split("\n")) {
    const match = /^(MemAvailable|SwapTotal|SwapFree):\s+(\d+)/u.exec(line);
    if (match) values[match[1]] = Number(match[2]);
  }
  return values;
}

function sessionSnapshot(stage) {
  const { paths } = controller(stage);
  const sessionsRoot = join(paths.dshHome, "sessions");
  if (!existsSync(sessionsRoot)) return { files: 0, substantiveFiles: 0, bytes: 0 };
  const stack = [sessionsRoot];
  let files = 0;
  let substantiveFiles = 0;
  let bytes = 0;
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.name === "session.v4.jsonl.zstd") {
        if (!path.includes("-town-fixture-polecats-")) continue;
        const size = statSync(path).size;
        files += 1;
        bytes += size;
        if (size >= 1000) substantiveFiles += 1;
      }
    }
  }
  return { files, substantiveFiles, bytes };
}

function tmuxPaneCount(stage) {
  const { paths, env } = controller(stage);
  try {
    const output = execFileSync("tmux", ["-L", env.GT_TMUX_SOCKET, "list-panes", "-a", "-F", "#{session_name} #{pane_pid} #{pane_dead}"], {
      cwd: paths.town, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
    });
    return output.split(/\r?\n/u).filter(line => {
      if (!line.endsWith(" 0")) return false;
      const session = line.split(" ", 1)[0];
      return /^ld-[a-z0-9][a-z0-9-]*$/u.test(session) &&
        session !== "ld-witness" && session !== "ld-refinery";
    }).length;
  } catch {
    return 0;
  }
}

function sample(stage) {
  const tasks = listTasks(stage);
  const polecats = listPolecats(stage);
  const states = {};
  for (const polecat of polecats) {
    const state = polecat.state ?? polecat.status ?? "unknown";
    states[state] = (states[state] ?? 0) + 1;
  }
  const memory = memorySnapshot();
  return {
    at: new Date().toISOString(),
    load1: Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]),
    memAvailableKiB: memory.MemAvailable,
    swapUsedKiB: (memory.SwapTotal ?? 0) - (memory.SwapFree ?? 0),
    tasks: {
      total: tasks.length,
      closed: tasks.filter(task => task.status === "closed").length,
      inProgress: tasks.filter(task => task.status === "in_progress").length,
      assignees: new Set(tasks.map(task => task.assignee).filter(Boolean)).size
    },
    polecats: { total: polecats.length, states },
    tmuxPanes: tmuxPaneCount(stage),
    dshSessions: sessionSnapshot(stage)
  };
}

function emergencyStop(stage, reason) {
  const { paths, env } = controller(stage);
  try { run(stage, "gt", ["scheduler", "pause"]); } catch { /* retain first stop reason */ }
  try {
    execFileSync("tmux", ["-L", env.GT_TMUX_SOCKET, "kill-server"], {
      cwd: paths.town, env, stdio: ["ignore", "ignore", "ignore"], timeout: 30_000
    });
  } catch { /* no stage-local tmux server */ }
  json(join(paths.evidence, `stage-${stage}-stop.json`), { at: new Date().toISOString(), reason });
}

async function monitor(stage) {
  const { paths } = controller(stage);
  const state = readJson(paths.state);
  if (state.phase !== "dispatched") throw new Error(`expected dispatched phase, got ${state.phase}`);
  const dispatchSamplesPath = join(paths.evidence, `stage-${stage}-dispatch-samples.jsonl`);
  const samples = existsSync(dispatchSamplesPath)
    ? readFileSync(dispatchSamplesPath, "utf8").split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line))
    : [];
  const deadline = Date.now() + 30 * 60 * 1000;
  let result = "failed";
  let stopReason = null;
  while (Date.now() < deadline) {
    let current;
    try { current = sample(stage); }
    catch {
      stopReason = "sampling-failed";
      emergencyStop(stage, stopReason);
      break;
    }
    samples.push(current);
    writeFileSync(join(paths.evidence, `stage-${stage}-samples.jsonl`),
      `${samples.map(value => JSON.stringify(value)).join("\n")}\n`);
    console.log(JSON.stringify(current));
    const assessment = assessLoadSample(current, stage);
    if (assessment.result === "failed") {
      stopReason = assessment.stopReason;
      emergencyStop(stage, stopReason);
      break;
    }
    if (assessment.result === "passed") { result = "passed"; break; }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 5000));
  }
  if (!stopReason && result !== "passed") {
    stopReason = "stage-timeout";
    emergencyStop(stage, stopReason);
  }
  const verdict = evaluateInfrastructureSmoke(stage, samples, stopReason);
  const final = samples.at(-1);
  result = verdict.result;
  stopReason = verdict.stopReason;
  const summary = {
    schema: "swarm-rdsh-load-qualification/v1",
    stage,
    ...verdict,
    startedAt: samples[0]?.at,
    finishedAt: final?.at,
    sampleCount: samples.length,
    final
  };
  json(join(paths.evidence, `stage-${stage}-summary.json`), summary);
  json(paths.state, { ...state, phase: result, finishedAt: new Date().toISOString(), stopReason });
  console.log(JSON.stringify(summary));
  if (result !== "passed") process.exitCode = 1;
}

function status(stage) {
  console.log(JSON.stringify(sample(stage), null, 2));
}

function stop(stage) {
  emergencyStop(stage, "operator-requested-stop");
  console.log(JSON.stringify({ stage, stopped: true }));
}

function shutdown(stage) {
  const output = run(stage, "gt", ["shutdown", "--all", "--yes"], locations(stage).town, 180_000);
  console.log(output);
}

async function main() {
  const [command, rawStage] = process.argv.slice(2);
  const stage = stageNumber(rawStage);
  if (command === "setup") setup(stage);
  else if (command === "prepare") prepare(stage);
  else if (command === "queue") queue(stage);
  else if (command === "dispatch") await dispatch(stage);
  else if (command === "monitor") await monitor(stage);
  else if (command === "status") status(stage);
  else if (command === "stop") stop(stage);
  else if (command === "shutdown") shutdown(stage);
  else throw new Error("usage: qualify-load.mjs setup|prepare|queue|dispatch|monitor|status|stop|shutdown <4|8|16|32|100>");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) await main();
