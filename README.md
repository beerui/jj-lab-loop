# jj-lab-loop（Loop gym）

jj-flow **实验场 Lab 1**：单仓 `ralph` + `review` + `end` 练习场。

这不是生产项目族角色，**不要**命名为 项目A / `handoff` / `project-a`。

| 字段 | 值 |
| --- | --- |
| lab id | `loop-gym` |
| 推荐仓名 | `jj-lab-loop`（与 `jj-flow` 同级） |
| 协议设计 | [jj-flow-labs](https://github.com/beerui/jj-flow/blob/main/docs/design-docs/jj-flow-labs.md) |
| 发现根 | 环境变量 `JJ_LAB_LOOP_ROOT` = **本仓绝对路径** |

PR2 只含仓骨架（本 README、`.gitignore`、`lab-manifest.json`）。种子与 `scripts/lab.mjs` 见后续 PR3。

`_materialized/` 已被 ignore。物化后的业务 git toplevel 是 `_materialized/loop-gym/`，**不是**本种子仓根。不要在本仓根跑 `$jj-end` / `commit-prep`。

```powershell
$env:JJ_LAB_LOOP_ROOT = "D:\daji-docs\jj-lab-loop"
```
