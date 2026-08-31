import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../lib/lab-util.mjs';

const BANNED = new Set(['项目A', '项目B', '项目C']);

function walkJson(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, visit));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) visit(k, v, value);
    for (const v of Object.values(value)) walkJson(v, visit);
  }
}

export function checkRoleLiterals({ naming, plane, episode } = {}) {
  const findings = [];
  const inspect = (label, obj) => {
    if (!obj) return;
    walkJson(obj, (key, value) => {
      if (['id', 'origin_project', 'requirement_owner', 'lead_project', 'role'].includes(key)
        && typeof value === 'string' && BANNED.has(value)) {
        findings.push(finding('L1-ROLE', `${label} ${key}=${value}`, 'Use loop-gym / notes-alpha / notes-beta; omit episode role.'));
      }
      if (key === 'targets' && Array.isArray(value)) {
        for (const t of value) {
          const id = typeof t === 'string' ? t : t?.project_id || t?.id;
          if (typeof id === 'string' && BANNED.has(id)) {
            findings.push(finding('L1-ROLE', `${label} target ${id}`, 'Do not use production family roles.'));
          }
        }
      }
      if (key === 'labels' && Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && BANNED.has(item)) {
            findings.push(finding('L1-ROLE', `${label} labels ${item}`, 'labels must not equal 项目A/B/C.'));
          }
        }
      }
    });
  };
  inspect('naming', naming);
  inspect('plane', plane);
  if (episode && (episode.role === '项目A' || episode.role === '项目B' || episode.role === '项目C')) {
    findings.push(finding('L1-ROLE', 'episode.role is a production role', 'Omit role on lab episodes.'));
  }
  inspect('episode', episode);
  void path;
  void fs;
  return { ok: findings.length === 0, findings };
}
