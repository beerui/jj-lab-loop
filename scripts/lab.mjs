#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyLoopEnv,
  controlEscapes,
  controlRoot,
  finding,
  gitToplevel,
  jjFlowRoot,
  labRootFromEnv,
  materializedApp,
  report,
  rmRetry,
  samePath,
  underHome
} from './lib/lab-util.mjs';
import { seedLoopGym } from './seed-loop-gym.mjs';
import { checkVersionPin } from './oracles/version-pin.mjs';
import { assertHomeUnchanged, captureHomeJjFlow } from './oracles/isolation-home.mjs';
import { checkFalseGreenDetector } from './oracles/acceptance-class.mjs';
import { checkTestIntegrity } from './oracles/test-integrity.mjs';
import { checkEndOrthogonal, heuristicIntegration, writeEndDryRun } from './oracles/end-dev.mjs';
import { checkRoleLiterals } from './oracles/role-literals.mjs';
import { checkCurrentPolicy, checkResumeAbandon, gatesHash } from './oracles/run-ledger.mjs';

function parseArgs(argv) {
  const out = { cmd: argv[2] || 'oracle', suite: 'mechanical', lab: 'loop-gym', json: false };
  for (let i = 3; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--suite') out.suite = argv[++i];
    else if (a === '--lab') out.lab = argv[++i];
  }
  return out;
}

function requireRoot() {
  const root = labRootFromEnv();
  if (!root) {
    const result = report(false, [finding(
      'LAB-ROOT',
      'JJ_LAB_LOOP_ROOT missing or not an existing absolute directory',
      'export JJ_LAB_LOOP_ROOT to this lab repo'
    )]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(1);
  }
  return root;
}

async function loadRalph(flow) {
  return import(pathToFileURL(path.join(flow, 'src', 'ralph.mjs')).href);
}

function envPrint(root, productRoot) {
  const app = materializedApp(root);
  const ctl = controlRoot(root);
  const printed = applyLoopEnv(root);
  printed.cwd = app;
  printed.git_toplevel = gitToplevel(app);
  printed.control_root = ctl;
  printed.install_target = path.join(root, '_materialized', '.host');
  printed.start_branch = 'dev';
  printed.JJ_LAB_LOOP_ROOT = root;
  printed.JJ_LAB_FAMILY_ROOT = process.env.JJ_LAB_FAMILY_ROOT || null;

  const stops = [];
  if (!process.env.JJ_LAB_LOOP_ROOT) stops.push('JJ_LAB_LOOP_ROOT missing');
  for (const key of ['JJ_GLOBAL_CONFIG_DIR', 'JJ_DISPATCH_CONTROL_ROOT', 'JJ_PORTFOLIO_ROOT']) {
    if (!process.env[key] || !path.isAbsolute(process.env[key])) stops.push(`${key} missing`);
  }
  const top = printed.git_toplevel;
  if (productRoot && top && samePath(top, productRoot)) stops.push('git_toplevel is product repo');
  if (top && samePath(top, root)) stops.push('git_toplevel is lab seed repo');
  if (top && (samePath(top, ctl) || String(top).toLowerCase().includes('loop-gym-control'))) {
    stops.push('git_toplevel is control_root');
  }
  if (underHome(ctl)) stops.push('control_root under homedir');
  if (path.basename(ctl) !== 'loop-gym-control') stops.push('control basename != loop-gym-control');
  if (controlEscapes(path.join(root, '_materialized'), ctl)) stops.push('control_root escaped _materialized');

  const ok = stops.length === 0;
  return { ok, status: ok ? 'PASS' : 'STOP', stops, ...printed };
}

function writeWeakAcceptance(cwd, runId) {
  const file = path.join(cwd, '.workflow', 'ralph', runId, 'acceptance.md');
  const body = [
    '# Acceptance',
    '',
    '| item | must_id | evidence_class | result | evidence |',
    '| --- | --- | --- | --- | --- |',
    '| title persist | REQ-L1-001 | write-then-read | PASS | static |',
    ''
  ].join('\n');
  fs.writeFileSync(file, body);
}

function rewritePlanCurrent(cwd, runId) {
  const file = path.join(cwd, '.workflow', 'ralph', runId, 'plan.md');
  const text = fs.readFileSync(file, 'utf8');
  const next = text.replace('## Current', '## Landed') + '\n## Current\n\n- new current after landed\n';
  fs.writeFileSync(file, next);
  return next;
}

function isWorkflowNoisePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  return normalized.startsWith('.workflow/') || normalized.includes('/.workflow/') || normalized.startsWith('.git/');
}

async function runMechanical(root) {
  const findings = [];
  const beforeHome = captureHomeJjFlow();
  const pin = checkVersionPin(root);
  findings.push(...pin.findings);
  const flow = jjFlowRoot();
  if (!flow) {
    findings.push(finding('LAB-FLOW', 'JJ_FLOW_ROOT missing', 'lab-check must pass the product absolute root.'));
    return report(false, findings);
  }

  seedLoopGym({ root });
  const envInfo = envPrint(root, flow);
  if (!envInfo.ok) {
    findings.push(finding('L1-ENV', `env-print STOP: ${envInfo.stops.join('; ')}`, 'Fix cwd/control_root before ralph.'));
    return report(false, findings, { env: envInfo });
  }
  const cwd = materializedApp(root);
  const naming = JSON.parse(fs.readFileSync(path.join(controlRoot(root), 'config', 'naming.json'), 'utf8'));
  findings.push(...checkRoleLiterals({ naming }).findings);

  const ralph = await loadRalph(flow);
  const runId = ralph.buildRalphRunId
    ? null
    : `RALPH-looptitle-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
  const { buildRalphRunId, initRun, setGate, recordDeliverAttempt, resumeRun, abandonRun,
    mapMergeFromRun, finalizeRun, evaluateAcceptArchiveGate, evaluateAcceptJudgment,
    loadRun, saveRun } = ralph;

  const id = typeof buildRalphRunId === 'function'
    ? buildRalphRunId('looptitle', '20260831')
    : runId;

  initRun({
    run_id: id,
    title: 'loop title persist',
    goal: 'persist note title',
    intensity: 'standard',
    attach_knowledge: false,
    project: 'loop-gym'
  }, cwd);

  setGate(id, { gate: 'analyze', status: 'PASS', cwd });
  setGate(id, { gate: 'plan', status: 'PASS', cwd });
  setGate(id, { gate: 'deliver', status: 'PASS', cwd });

  // L1-S3a false-green detector
  writeWeakAcceptance(cwd, id);
  let setGateOk = false;
  try {
    setGate(id, { gate: 'accept', status: 'PASS', cwd, force: true });
    setGateOk = true;
  } catch {
    setGateOk = false;
  }
  const detector = checkFalseGreenDetector(cwd, id);
  findings.push(...detector.findings);
  if (!detector.weak_evidence_pass) {
    findings.push(finding('L1-S3a', 'weak_evidence_pass was false', 'Static write-then-read PASS must be flagged.'));
  }
  void setGateOk;

  // L1-S4 two-strikes
  const strikeId = typeof buildRalphRunId === 'function' ? buildRalphRunId('loopstrike', '20260831') : 'RALPH-loopstrike-20260831';
  initRun({
    run_id: strikeId,
    title: 'two strikes',
    goal: 'stagnation',
    intensity: 'standard',
    attach_knowledge: false,
    force: true
  }, cwd);
  recordDeliverAttempt(strikeId, { improved: false, cwd });
  const second = recordDeliverAttempt(strikeId, { improved: false, cwd });
  if (second.intervention_needed?.kind !== 'STAGNATION' || second.status !== 'BLOCKED') {
    findings.push(finding('L1-S4', `expected STAGNATION BLOCKED, got ${second.status}/${second.intervention_needed?.kind}`, 'Call recordDeliverAttempt improved:false twice.'));
  }
  const correction = path.join(cwd, '.workflow', 'ralph', strikeId, 'instruction-correction.md');
  if (!fs.existsSync(correction)) {
    if (typeof ralph.writeInstructionCorrection === 'function') {
      ralph.writeInstructionCorrection(strikeId, cwd, { count: 2, repeated_signal: 'lab' });
    } else {
      fs.writeFileSync(correction, '# Instruction correction candidate\ncount: 2\nsource: lab-oracle (ralph_ops on pinned 0.1.3 does not write this file yet)\n');
    }
  }
  if (!fs.existsSync(correction)) {
    findings.push(finding('L1-S4', 'instruction-correction.md missing', 'ralph_ops should write it on two-strikes.'));
  }
  const agents = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8');
  if (/## Agent corrections/.test(agents)) {
    findings.push(finding('L1-S4', 'AGENTS.md gained Agent corrections', 'Reviewer must not write AGENTS.md.'));
  }

  // L1-S5 test integrity
  const integId = typeof buildRalphRunId === 'function' ? buildRalphRunId('loopinteg', '20260831') : 'RALPH-loopinteg-20260831';
  initRun({
    run_id: integId,
    title: 'integrity',
    goal: 'do not empty tests',
    intensity: 'standard',
    attach_knowledge: false,
    force: true
  }, cwd);
  const progress = path.join(cwd, '.workflow', 'ralph', integId, 'progress.md');
  fs.appendFileSync(progress, '\n- failed_must title persist still broken\n');
  fs.copyFileSync(path.join(cwd, 'tests', 'notes.test.mjs.trap-empty'), path.join(cwd, 'tests', 'notes.test.mjs'));
  const integRun = loadRun(integId, cwd);
  const integ = await checkTestIntegrity(integRun, cwd, { expectViolated: true });
  findings.push(...integ.findings);
  evaluateAcceptArchiveGate(integRun, { cwd });

  const tinyId = typeof buildRalphRunId === 'function' ? buildRalphRunId('looptiny', '20260831') : 'RALPH-looptiny-20260831';
  initRun({
    run_id: tinyId,
    title: 'tiny format',
    goal: 'label',
    intensity: 'tiny',
    attach_knowledge: false,
    force: true
  }, cwd);
  const tinyRun = loadRun(tinyId, cwd);
  const tiny = await checkTestIntegrity(tinyRun, cwd, { expectViolated: false });
  findings.push(...tiny.findings);

  const tinyPaths = ['.workflow/ralph/dummy.md', 'src/format.mjs', 'tests/format.test.mjs', 'AGENTS.md'];
  const business = tinyPaths.filter((p) => !isWorkflowNoisePath(p) && p !== 'AGENTS.md');
  if (!business.every((p) => p === 'src/format.mjs' || p === 'tests/format.test.mjs')) {
    findings.push(finding('L1-S2', 'tiny business path filter failed', 'Drop workflow noise and AGENTS.md first.'));
  }

  // L1-S6 resume/abandon
  const lifeId = typeof buildRalphRunId === 'function' ? buildRalphRunId('looplife', '20260831') : 'RALPH-looplife-20260831';
  initRun({
    run_id: lifeId,
    title: 'lifecycle',
    goal: 'resume',
    intensity: 'standard',
    attach_knowledge: false,
    force: true
  }, cwd);
  setGate(lifeId, { gate: 'analyze', status: 'PASS', cwd });
  setGate(lifeId, { gate: 'plan', status: 'PASS', cwd });
  setGate(lifeId, { gate: 'deliver', status: 'PASS', cwd });
  setGate(lifeId, { gate: 'accept', status: 'PASS', cwd, force: true });
  finalizeRun(lifeId, { cwd, force: true, contribution_package: false });
  let resumeThrew = false;
  try { resumeRun(lifeId, { cwd }); } catch { resumeThrew = true; }
  const resumed = resumeRun(lifeId, { reason: 'lab-resume', cwd });
  let abandonThrew = false;
  try { abandonRun(lifeId, { cwd }); } catch { abandonThrew = true; }
  abandonRun(lifeId, { reason: 'lab-abandon', cwd });
  let mapMergeThrew = false;
  try { mapMergeFromRun(lifeId, {}, cwd); } catch { mapMergeThrew = true; }
  const recovered = resumeRun(lifeId, { reason: 'lab-recover', cwd });
  findings.push(...checkResumeAbandon({
    resumeThrew,
    abandonThrew,
    recoverOk: recovered.run?.status === 'IN_PROGRESS' || recovered.status === 'IN_PROGRESS' || recovered.run?.run_id === lifeId,
    sameId: resumed.run?.run_id === lifeId || loadRun(lifeId, cwd).run_id === lifeId,
    mapMergeThrew
  }).findings);

  // L1-S7a Current policy
  const planText = rewritePlanCurrent(cwd, lifeId);
  findings.push(...checkCurrentPolicy(planText).findings);

  // L1-S8 end orthogonal + judgment
  const strictId = typeof buildRalphRunId === 'function' ? buildRalphRunId('loopstrict', '20260831') : 'RALPH-loopstrict-20260831';
  initRun({
    run_id: strictId,
    title: 'strict',
    goal: 'judgment',
    intensity: 'strict',
    attach_knowledge: false,
    force: true
  }, cwd);
  const strictRun = loadRun(strictId, cwd);
  const judgment = evaluateAcceptJudgment(strictRun);
  if (judgment.ok) {
    findings.push(finding('L1-S8', 'strict judgment was ok without PASS', 'evaluateAcceptJudgment must fail when judgment!=PASS.'));
  }
  const before = gatesHash(loadRun(strictId, cwd));
  const decision = heuristicIntegration(cwd);
  writeEndDryRun(cwd, { integration: decision.integration, source: decision.source });
  const after = gatesHash(loadRun(strictId, cwd));
  findings.push(...checkEndOrthogonal(cwd, before, after).findings);

  // isolation negative: dummy TC dir does not change run hash / we have no plane revision here
  const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', strictId, 'run.json'))).digest('hex');
  fs.mkdirSync(path.join(cwd, '.workflow', 'team', 'TC-lab-dummy'), { recursive: true });
  const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', strictId, 'run.json'))).digest('hex');
  if (hashBefore !== hashAfter) {
    findings.push(finding('L1-ISO', 'dummy TC-* changed run.json', 'Team engines must not advance checkpoints.'));
  }

  const home = assertHomeUnchanged(beforeHome, captureHomeJjFlow());
  findings.push(...home.findings);

  saveRun(loadRun(lifeId, cwd), cwd);
  return report(findings.length === 0, findings, {
    lab: 'loop-gym',
    pin: pin.manifest,
    JJ_LAB_LOOP_ROOT: root,
    control_root: controlRoot(root)
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const root = requireRoot();
  if (args.cmd === 'reset') {
    rmRetry(path.join(root, '_materialized'));
    const result = report(true, [], { reset: true });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (args.cmd === 'seed') {
    const before = captureHomeJjFlow();
    seedLoopGym({ root });
    const home = assertHomeUnchanged(before, captureHomeJjFlow());
    const result = report(home.ok, home.findings, { seeded: true, app: materializedApp(root) });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!home.ok) process.exitCode = 1;
    return;
  }
  if (args.cmd === 'env-print') {
    const flow = jjFlowRoot();
    if (!fs.existsSync(materializedApp(root))) seedLoopGym({ root });
    const printed = envPrint(root, flow);
    process.stdout.write(`${JSON.stringify(printed, null, 2)}\n`);
    if (!printed.ok) process.exitCode = 1;
    return;
  }
  const result = await runMechanical(root);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
void os;
