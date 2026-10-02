# skills —— 大模型分析能力（P0：契约 + 校验 + 本地 mock）

这里放的是**与后端无关的 skill 层**。小程序不直接调大模型（前端可反编译，Key 一定泄露），
所以这一层的职责是：把「输入原文 → 固定结构的分析结果」的**契约**定死，
让任何一个中转后端（微信云开发云函数 / 自建 Node）都能照着实现。

## 目录

```
skills/
├─ README.md                    本文件
├─ sync-dimensions.cjs          从 src/types/jobProfile.ts 生成十维与 schema（唯一事实来源）
├─ verify-skill.cjs             自测：样例必须通过校验、编造的依据必须被抓出来
├─ mock-server.cjs              本地 mock 中转（无需任何 API Key，跑通全链路）
├─ _shared/
│  └─ dimensions.json           ← 生成物，勿手改
└─ student-profile-analyze/
   ├─ prompt.md                 系统提示词（含诚实性红线）
   ├─ contract.cjs              校验器（结构 + 语义 + evidence 必须是原文子串）
   └─ schema.json                ← 生成物，勿手改
```

## 怎么跑

```bash
# 1) 生成十维与 schema（改了 JOB_DIMENSIONS 之后必须重跑）
node skills/sync-dimensions.cjs

# 2) 自测：样例必须通过；编造 evidence 必须被拒
node skills/verify-skill.cjs

# 3) 起本地 mock 中转（默认 127.0.0.1:3100）
node skills/mock-server.cjs
#    POST /v1/tasks          提交任务 -> { task_id }
#    GET  /v1/tasks/{id}     轮询结果 -> { status, profile, ... }
#    GET  /v1/skills         列出 skill 与提示词
```

开发者工具里可以直接把请求地址指向 `http://127.0.0.1:3100` —— 项目已配置
`urlCheck: false`（不校验合法域名），本地地址可用。

## 三条不能破的规则

1. **十维 key 只定义一次**：以 `src/types/jobProfile.ts` 的 `JOB_DIMENSIONS` 为准，
   提示词、schema、校验器全部由它生成；对不上就报错退出，绝不"各自维护一份"。
2. **evidence 必须是原文的子串**：最便宜的防幻觉手段。编造的依据会被丢弃；
   全丢则把该维度的 confidence 压到 0.3。
3. **mock 必须自我标注**：mock 返回 `mock: true`、`skill_version: "…-mock"`，
   绝不冒充真实模型结果；真实后端才允许 `parse_method: "llm"` 且 `mock: false`。

## 与小程序现有代码的关系

`src/api/studentProfile.ts` 已经是「提交任务 → 轮询 → 失败落回本地规则」的模式。
这一层不改变它的形状，只把「中转服务该返回什么」写清楚：

- 校验通过 → `parse_method: "llm"`，前端照常走 `normalizeStudentProfile`
- 超时 / 校验不过 / 未配置 → 前端降级到本地规则解析，并如实标注 `parse_method: "rule"`
