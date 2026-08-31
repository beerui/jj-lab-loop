import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { finding, jjFlowRoot } from '../lib/lab-util.mjs';

function looksLikeFixRunLocal(run, cwd) {
  const progress = path.join(cwd, '.workflow', 'ralph', run.run_id, 'progress.md');
  const text = fs.existsSync(progress) ? fs.readFileSync(progress, 'utf8') : '';
  if (/\bfailed_must\b/i.test(text) || /\buser_correction\b/i.test(text) || /\bover_claimed\b/i.test(text)) return true;
  const latest = Array.isArray(run.reviews) ? run.reviews[run.reviews.length - 1] : null;
  return Boolean(latest && latest.outcome === 'NEEDS_CHANGES');
}

function emptied(cwd, rel) {
  const abs = path.join(cwd, rel);
  if (!fs.existsSync(abs)) return true;
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) return true;
  return !/\b(?:test|it|describe)\s*\(/.test(text);
}

export async function detectIntegrity(run, cwd) {
  const flow = jjFlowRoot();
  if (flow) {
    try {
      const mod = await import(pathToFileURL(path.join(flow, 'src', 'ralph.mjs')).href);
      if (typeof mod.detectTestIntegrityViolation === 'function') {
        return mod.detectTestIntegrityViolation(run, cwd);
      }
    } catch {
      /* lab-local detector */
    }
  }
  const result = { violated: false, paths: [], reason: null };
  if ((run.intensity || 'standard') === 'tiny' && !looksLikeFixRunLocal(run, cwd)) return result;
  if (!looksLikeFixRunLocal(run, cwd)) return result;
  const rel = path.join('tests', 'notes.test.mjs');
  if (emptied(cwd, rel)) {
    return { violated: true, paths: [rel.replaceAll('\\', '/')], reason: 'emptied test file' };
  }
  return result;
}

export async function checkTestIntegrity(run, cwd, { expectViolated }) {
  const hit = await detectIntegrity(run, cwd);
  if (Boolean(hit.violated) !== Boolean(expectViolated)) {
    return {
      ok: false,
      hit,
      findings: [finding(
        'L1-S5',
        `test_integrity.violated=${hit.violated} expected ${expectViolated}`,
        'Append failed_must then overlay trap-empty tests/notes.test.mjs.'
      )]
    };
  }
  return { ok: true, hit, findings: [] };
}
