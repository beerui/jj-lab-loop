import os from 'node:os';
import path from 'node:path';
import { finding, snapshotFileSet } from '../lib/lab-util.mjs';

export function captureHomeJjFlow() {
  return snapshotFileSet(path.join(os.homedir(), '.jj-flow'));
}

export function assertHomeUnchanged(before, after) {
  const a = [...before].sort();
  const b = [...after].sort();
  if (a.length === b.length && a.every((item, i) => item === b[i])) {
    return { ok: true, findings: [] };
  }
  return {
    ok: false,
    findings: [finding(
      'L1-HOME',
      'homedir .jj-flow file set changed during lab run',
      'Never call ensureDispatchControlRoot; keep JJ_DISPATCH_CONTROL_ROOT inside _materialized/loop-gym-control.'
    )]
  };
}
