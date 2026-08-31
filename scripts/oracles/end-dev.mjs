import fs from 'node:fs';
import path from 'node:path';
import { finding, git } from '../lib/lab-util.mjs';

export function heuristicIntegration(cwd) {
  const branches = git(cwd, ['branch', '--format', '%(refname:short)']).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const hasDev = branches.includes('dev');
  const hasStaging = branches.includes('staging');
  const agents = path.join(cwd, 'AGENTS.md');
  const docs = fs.existsSync(agents) ? fs.readFileSync(agents, 'utf8') : '';
  const closeoutStaging = /closeout[^\n]*staging/i.test(docs) || /integration\s*=\s*staging/i.test(docs);
  const integrationEq = /integration\s*=/.test(docs);
  if (hasDev && hasStaging && !closeoutStaging && !integrationEq) {
    return { integration: 'dev', source: 'heuristic' };
  }
  if (hasDev) return { integration: 'dev', source: 'heuristic' };
  return { integration: 'main', source: 'heuristic' };
}

export function writeEndDryRun(cwd, payload) {
  const dir = path.join(cwd, '.workflow');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'end-dry-run.json');
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

export function checkEndOrthogonal(cwd, beforeHash, afterHash) {
  const findings = [];
  const decision = heuristicIntegration(cwd);
  if (decision.integration !== 'dev' || decision.source !== 'heuristic') {
    findings.push(finding('L1-S8', `end heuristic ${JSON.stringify(decision)}`, 'Seed must keep dev+staging without docs closeout=staging.'));
  }
  if (beforeHash !== afterHash) {
    findings.push(finding('L1-S8', 'end-dry-run changed run.json gates hash', 'end is orthogonal to ralph gates.'));
  }
  return { ok: findings.length === 0, findings, decision };
}
