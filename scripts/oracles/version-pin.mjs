import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../lib/lab-util.mjs';

export function checkVersionPin(labRoot) {
  const findings = [];
  const file = path.join(labRoot, 'lab-manifest.json');
  if (!fs.existsSync(file)) {
    findings.push(finding('L1-PIN', 'missing lab-manifest.json', 'Add pin fields.', { path: file }));
    return { ok: false, findings };
  }
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const version = typeof manifest.harness_version === 'string' ? manifest.harness_version.trim() : '';
  const commit = typeof manifest.jj_flow_commit === 'string' ? manifest.jj_flow_commit.trim() : '';
  if (!version && !commit) {
    findings.push(finding('L1-PIN', 'pin missing', 'Set harness_version and/or jj_flow_commit.', { path: file }));
  }
  if (commit && (/^(UNPINNED|TODO|main)$/i.test(commit) || !/^[0-9a-f]{7,40}$/i.test(commit))) {
    findings.push(finding('L1-PIN', `invalid jj_flow_commit ${commit}`, 'Use 7–40 hex SHA.', { path: file }));
  }
  return { ok: findings.length === 0, findings, manifest };
}
