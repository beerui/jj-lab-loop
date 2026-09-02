import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LAB_ID = 'loop-gym';
export const GIT_NAME = 'jj-flow lab seed';
export const GIT_EMAIL = 'lab-seed@jj-flow.invalid';
export const GIT_DATE = '2026-08-31T00:00:00Z';

export function labRootFromEnv(env = process.env) {
  const raw = env.JJ_LAB_LOOP_ROOT;
  if (!raw || !path.isAbsolute(raw)) return null;
  try {
    if (fs.statSync(raw).isDirectory()) return path.resolve(raw);
  } catch {
    return null;
  }
  return null;
}

export function materializedApp(root) {
  return path.join(root, '_materialized', 'loop-gym');
}

export function controlRoot(root) {
  return path.join(root, '_materialized', 'loop-gym-control');
}

export function originPath(root) {
  return path.join(root, '_materialized', 'loop-gym.origin.git');
}

export function jjFlowRoot(env = process.env) {
  const raw = env.JJ_FLOW_ROOT;
  if (!raw || !path.isAbsolute(raw)) return null;
  try {
    if (fs.statSync(raw).isDirectory()) return path.resolve(raw);
  } catch {
    return null;
  }
  return null;
}

export function rmRetry(target, { attempts = 5 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
      const code = error && error.code;
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(code) || i === attempts - 1) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      continue;
    }
    if (!fs.existsSync(target)) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (fs.existsSync(target)) throw new Error(`reset failed, still exists: ${target}`);
}

export function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function git(cwd, args, extraEnv = {}) {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: GIT_NAME,
    GIT_AUTHOR_EMAIL: GIT_EMAIL,
    GIT_AUTHOR_DATE: GIT_DATE,
    GIT_COMMITTER_NAME: GIT_NAME,
    GIT_COMMITTER_EMAIL: GIT_EMAIL,
    GIT_COMMITTER_DATE: GIT_DATE,
    ...extraEnv
  };
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env, windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout || result.status}`);
  }
  return (result.stdout || '').trim();
}

export function configureRepo(cwd) {
  git(cwd, ['config', 'user.name', GIT_NAME]);
  git(cwd, ['config', 'user.email', GIT_EMAIL]);
  git(cwd, ['config', 'core.autocrlf', 'false']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);
}

export function gitToplevel(cwd) {
  try {
    return path.resolve(git(cwd, ['rev-parse', '--show-toplevel']));
  } catch {
    return null;
  }
}

/** Live run dir: P2 `tasks/<id>/` first, then leftover `ralph/<id>/`. */
export function ralphRunDir(cwd, runId) {
  const tasks = path.join(cwd, '.workflow', 'ralph', 'tasks', runId);
  if (fs.existsSync(tasks)) return tasks;
  return path.join(cwd, '.workflow', 'ralph', runId);
}

export function ralphRunJsonPath(cwd, runId) {
  const dir = ralphRunDir(cwd, runId);
  const nested = path.join(dir, '.state', 'run.json');
  if (fs.existsSync(nested)) return nested;
  return path.join(dir, 'run.json');
}

export function snapshotFileSet(dir) {
  const out = new Set();
  if (!fs.existsSync(dir)) return out;
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.add(path.resolve(abs));
    }
  };
  walk(dir);
  return out;
}

export function applyLoopEnv(root) {
  const ctl = controlRoot(root);
  const app = materializedApp(root);
  process.env.JJ_LAB_LOOP_ROOT = root;
  process.env.JJ_GLOBAL_CONFIG_DIR = path.join(ctl, 'config');
  process.env.JJ_DISPATCH_CONTROL_ROOT = ctl;
  process.env.JJ_PORTFOLIO_ROOT = app;
  return {
    cwd: app,
    git_toplevel: gitToplevel(app),
    control_root: ctl,
    JJ_GLOBAL_CONFIG_DIR: process.env.JJ_GLOBAL_CONFIG_DIR,
    JJ_DISPATCH_CONTROL_ROOT: process.env.JJ_DISPATCH_CONTROL_ROOT,
    JJ_PORTFOLIO_ROOT: process.env.JJ_PORTFOLIO_ROOT
  };
}

export function samePath(a, b) {
  if (!a || !b) return false;
  const left = path.resolve(a);
  const right = path.resolve(b);
  if (process.platform === 'win32') return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

export function underHome(abs) {
  const home = os.homedir();
  const rel = path.relative(path.resolve(home), path.resolve(abs));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function controlEscapes(expectedParent, controlAbs) {
  const parent = path.resolve(expectedParent);
  const ctl = path.resolve(controlAbs);
  const rel = path.relative(parent, ctl);
  return rel.startsWith('..') || path.isAbsolute(rel);
}

export function report(ok, findings, extra = {}) {
  return {
    schema_version: 'jj-flow/lab-oracle-report/1.0',
    ok,
    status: ok ? 'PASS' : 'FAIL',
    findings,
    ...extra
  };
}

export function finding(ruleId, reason, nextAction, extra = {}) {
  return { rule_id: ruleId, reason, next_action: nextAction, ...extra };
}
