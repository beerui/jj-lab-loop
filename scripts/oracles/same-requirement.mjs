import { finding } from '../lib/lab-util.mjs';

export function checkReviewSliceRefuse({ threw, message } = {}) {
  const findings = [];
  if (threw !== true) {
    findings.push(finding(
      'L1-S9',
      'review-slice init did not throw',
      'initRun must refuse review-fix / 审查修复 / 按审查 without --force or new_requirement.'
    ));
    return { ok: false, findings };
  }
  if (!/review-fix \/ 审查修复 is not a new requirement/.test(String(message || ''))) {
    findings.push(finding(
      'L1-S9',
      `wrong refuse: ${message || '(empty)'}`,
      'Keep the review-slice message; resume the live feature run instead of a new slug.'
    ));
  }
  return { ok: findings.length === 0, findings };
}

export function checkSameSessionRefuse({ threw, message, liveRunId } = {}) {
  const findings = [];
  if (threw !== true) {
    findings.push(finding(
      'L1-S10',
      'same-session init did not throw',
      'A second init with the same thread_id / host.thread_id must refuse.'
    ));
    return { ok: false, findings };
  }
  const text = String(message || '');
  if (!/same session already has live Ralph/.test(text)) {
    findings.push(finding(
      'L1-S10',
      `wrong refuse: ${text || '(empty)'}`,
      'Refuse with the same-session live Ralph message.'
    ));
  }
  if (liveRunId && !text.includes(liveRunId)) {
    findings.push(finding(
      'L1-S10',
      `refuse did not name live ${liveRunId}`,
      'Name the live run_id so the agent resumes it.'
    ));
  }
  return { ok: findings.length === 0, findings };
}

export function checkSameRequirementIndex(indexText = '') {
  const findings = [];
  const text = String(indexText || '');
  if (!/^## 同需求提示\s*$/m.test(text)) {
    findings.push(finding(
      'L1-S9',
      'index.md missing ## 同需求提示 after a review-slice sits beside another live run',
      'writeRalphIndex must prompt; never auto-merge or abandon.'
    ));
  }
  if (!/审查切片不是新任务|不自动合并/.test(text)) {
    findings.push(finding(
      'L1-S9',
      'index.md 同需求提示 lacks review-slice / 不自动合并 wording',
      'Prompt only. Resume the other live run.'
    ));
  }
  return { ok: findings.length === 0, findings };
}
