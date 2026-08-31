# jj-lab-loop（Loop gym）

jj-flow **实验场 Lab 1**：单仓 `ralph` + `review` + `end` 练习场。

这不是生产项目族角色，**不要**命名为 项目A / `handoff` / `project-a`。

| 字段 | 值 |
| --- | --- |
| lab id | `loop-gym` |
| 推荐仓名 | `jj-lab-loop`（与 `jj-flow` 同级） |
| 发现根 | `JJ_LAB_LOOP_ROOT` = **本仓绝对路径** |

```powershell
$env:JJ_LAB_LOOP_ROOT = "D:\daji-docs\jj-lab-loop"
$env:JJ_FLOW_ROOT = "D:\daji-docs\jj-flow"
node scripts/lab.mjs seed
node scripts/lab.mjs env-print --lab loop-gym
node scripts/lab.mjs oracle --suite mechanical --json
```

业务 git toplevel 是 `_materialized/loop-gym/`，control 是 `_materialized/loop-gym-control/`（非 git）。不要在本仓根跑 `$jj-end`。

Agent 场景见 `scenarios/`。机械 oracle 不覆盖 L1-S1/S3b/S7b。
