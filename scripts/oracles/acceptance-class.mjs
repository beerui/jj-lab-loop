import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../lib/lab-util.mjs';

const ALLOW = /write_then_read:(mock_ok|runtime_ok)/;

export function inspectAcceptance(cwd, runId) {
  const file = path.join(cwd, '.workflow', 'ralph', runId, 'acceptance.md');
  const tests = path.join(cwd, 'tests', 'notes.test.mjs');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const testText = fs.existsSync(tests) ? fs.readFileSync(tests, 'utf8') : '';
  const header = text.split(/\r?\n/).find((line) => line.includes('|') && /item/i.test(line));
  const malformed = !header || !/must_id/i.test(header) || !/evidence_class/i.test(header);
  let weak = false;
  const rows = text.split(/\r?\n/).filter((line) => /^\|/.test(line) && !/^\|\s*---/.test(line) && !/^\|\s*item\s*\|/i.test(line));
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length);
    const evidenceClass = cells[2] || '';
    const result = (cells[3] || '').toUpperCase();
    const evidence = cells[4] || '';
    if (evidenceClass === 'write-then-read' && result === 'PASS') {
      const tokenOk = ALLOW.test(evidence);
      const named = /REQ-L1-001/.test(testText) || /get\s*\(\s*id\s*\)/.test(testText);
      if (!tokenOk || !named) weak = true;
      if (/^(diff|rg|static)$/i.test(evidence.trim()) || /\b(diff|rg|static)\b/i.test(evidence) && !tokenOk) weak = true;
    }
  }
  if (malformed) {
    return { ok: true, malformed_table: true, weak_evidence_pass: true, findings: [] };
  }
  return { ok: true, malformed_table: false, weak_evidence_pass: weak, findings: [] };
}

export function checkFalseGreenDetector(cwd, runId) {
  const inspected = inspectAcceptance(cwd, runId);
  if (!inspected.weak_evidence_pass && !inspected.malformed_table) {
    return {
      ok: false,
      ...inspected,
      findings: [finding(
        'L1-S3a',
        'detector did not mark weak_evidence_pass',
        'Write a write-then-read PASS row with only static/diff evidence.'
      )]
    };
  }
  return { ok: true, ...inspected, findings: [] };
}
