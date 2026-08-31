import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../lib/lab-util.mjs';

export function gatesHash(run) {
  return crypto.createHash('sha256').update(JSON.stringify(run.gates || {})).digest('hex');
}

export function runJsonPath(cwd, runId) {
  return path.join(cwd, '.workflow', 'ralph', runId, 'run.json');
}

export function loadRunFile(cwd, runId) {
  return JSON.parse(fs.readFileSync(runJsonPath(cwd, runId), 'utf8'));
}

export function checkResumeAbandon({ resumeThrew, abandonThrew, recoverOk, sameId, mapMergeThrew }) {
  const findings = [];
  if (resumeThrew !== true) findings.push(finding('L1-S6', 'resume without reason did not throw', 'resumeRun requires reason.'));
  if (abandonThrew !== true) findings.push(finding('L1-S6', 'abandon without reason did not throw', 'abandonRun requires reason.'));
  if (!sameId) findings.push(finding('L1-S6', 'resume did not keep run_id', 'Same-run resume is required.'));
  if (!mapMergeThrew) findings.push(finding('L1-S6', 'map-merge after abandon did not throw', 'ABANDONED runs cannot map-merge.'));
  if (!recoverOk) findings.push(finding('L1-S6', 'resume after abandon failed', 'abandon is soft; resumeRun must recover.'));
  return { ok: findings.length === 0, findings };
}

export function checkCurrentPolicy(planText) {
  const findings = [];
  const current = [...planText.matchAll(/^## Current\b/gm)];
  if (current.length > 1) {
    const first = current[0].index;
    const second = current[1].index;
    const between = planText.slice(0, second);
    if (!/^## (Landed|Superseded)\b/m.test(between.slice(first))) {
      findings.push(finding('L1-S7a', 'second ## Current appeared before old block was Landed/Superseded', 'Move Current → Landed/Superseded first.'));
    }
  }
  const hasLanded = /^## Landed\b/m.test(planText) || /^## Superseded\b/m.test(planText);
  if (!hasLanded) {
    findings.push(finding('L1-S7a', 'plan.md has no Landed/Superseded after rewrite', 'Preserve old Current under Landed or Superseded.'));
  }
  return { ok: findings.length === 0, findings };
}
