# 图源（Mermaid）— 用于作品说明文档插图

> 使用方法（二选一）：
>
> 1. 打开 <https://mermaid.live>，把下面对应代码块粘贴进去 → 右侧预览 → 右上角 `Export` → `PNG`，即可插入 Word；
> 2. VS Code 安装 `Markdown Preview Mermaid Support` 插件，直接预览并截图。
>
> 导出建议：宽度 ≥ 1200px，导出后统一放到文档的图注下方。

---

## 图 2-1 系统用例图

```mermaid
flowchart LR
  S([求职者·学生]) --> A1(注册 / 登录)
  S --> A2(填写能力画像)
  S --> A3(浏览岗位 / 筛选)
  S --> A4(查看岗位画像)
  S --> A5(人岗匹配)
  S --> A6(生涯发展报告)
  S --> A7(知识库 / AI 助手)
  S --> A8(政策资源库 / 收藏)

  M([就业数据管理员]) --> B1(校招岗位数据同步)
  M --> B2(岗位数据维护)

  ADM([系统管理员]) --> C1(用户 / 知识库管理)
  ADM --> C2(招聘数据审核)

  A3 -.用例细化.-> A4
  A5 -.依赖.-> A2
  A5 -.依赖.-> A4
  A6 -.依赖.-> A5
```

---

## 图 3-1 系统总体架构图

```mermaid
flowchart TB
  subgraph client["客户端层 · 微信小程序（uni-app / Vue3 + TS）"]
    P1["页面层（主包 5 页 + 20+ 分包）"]
    P2["状态层（Pinia）"]
    P3["API 封装层（JWT 鉴权）"]
  end

  subgraph backend["服务层 · Django + DRF"]
    API["REST API（用户/画像/招聘/知识库/AI）"]
    Q["任务投递"]
    LIM["限流与鉴权中间件"]
  end

  subgraph async["异步任务层 · Celery"]
    W["Celery Worker（--pool=solo）"]
    R["Redis（Broker / 结果后端）"]
  end

  subgraph data["数据存储"]
    DB[("PostgreSQL 业务库")]
  end

  LLM["DeepSeek 大模型（OpenAI 兼容）"]

  P1 --> P2 --> P3
  P3 -- "HTTPS + JWT" --> LIM --> API
  API --> DB
  API -- "创建任务" --> Q --> R
  R --> W
  W -- "画像解析 / 问答" --> LLM
  W -- "结果落库" --> DB
  W -- "任务结果" --> R
```

---

## 图 3-2 数据库 E-R 图（简化）

```mermaid
erDiagram
  USER ||--o{ STUDENT_PROFILE : "拥有(1:1)"
  USER ||--o{ KNOWLEDGE_BASE : "创建"
  USER ||--o{ FAVORITE : "收藏"
  USER ||--o{ FOLLOW : "关注"
  USER ||--o{ NOTIFICATION : "接收"

  KNOWLEDGE_BASE ||--o{ KNOWLEDGE_NODE : "包含"
  KNOWLEDGE_BASE ||--o{ FOLLOW : "被关注"
  KNOWLEDGE_BASE ||--o{ SHARE : "分享"

  RECRUITMENT ||--o| JOB_PROFILE : "拥有(1:1)"

  USER {
    uuid id PK
    string username
    string password_hash
    string avatar
    datetime created_at
  }
  STUDENT_PROFILE {
    uuid id PK
    uuid user_id FK
    jsonb profile "十维/技能/证书/置信度"
    datetime created_at
  }
  RECRUITMENT {
    string id PK "复合键"
    string enterprise_name
    string credit_code
    string industry
    string job_name
    string recruit_major
  }
  JOB_PROFILE {
    uuid id PK
    string recruitment_id FK
    jsonb profile "十维要求/技能证书清单"
    datetime updated_at
  }
  KNOWLEDGE_BASE {
    uuid id PK
    string name
    string description
    boolean is_public
    uuid creator_id FK
  }
  KNOWLEDGE_NODE {
    uuid id PK
    uuid knowledge_base_id FK
    string name
    text content
    datetime updated_at
  }
  FAVORITE {
    uuid id PK
    uuid user_id FK
    string title
    datetime created_at
  }
  FOLLOW {
    uuid id PK
    uuid user_id FK
    uuid knowledge_base_id FK
    boolean is_active
  }
  NOTIFICATION {
    uuid id PK
    uuid user_id FK
    string content
    boolean is_read
  }
```

---

## 图 3-3 人岗匹配流程图

```mermaid
flowchart TD
  A["学生填写/更新能力画像"] --> B{"画像是否有效?"}
  B -- 否 --> A
  B -- 是 --> C["选择目标岗位（校招真实岗位/示例岗位）"]
  C --> D["读取岗位画像（十维要求 + 技能证书清单）"]
  D --> E["逐维计算达成度 fit = clamp(学生分/要求分, 0, 1)"]
  E --> F["专业技能/证书改用覆盖率口径（必须项2倍权重）"]
  F --> G["按置信度计算有效权重（未提要求维度权重=0）"]
  G --> H["四类目得分（加权平均）"]
  H --> I["扣除硬技能/证书缺口"]
  I --> J{"核心技能覆盖过低?"}
  J -- 是 --> K["总评封顶 30+70×覆盖率"]
  J -- 否 --> L{"可评估维度 < 3 项?"}
  K --> L
  L -- 是 --> M["按信息完整度封顶 + 标注'信息不足'"]
  L -- 否 --> N["输出匹配度与等级"]
  M --> N
  N --> O["输出十维差距 / 缺口 / 关键短板 / 提升建议"]
```

---

## 图 3-4 AI 异步任务时序图

```mermaid
sequenceDiagram
  autonumber
  participant U as 用户（小程序）
  participant F as 前端页面
  participant A as Django API
  participant Q as Celery/Redis
  participant W as Celery Worker
  participant L as DeepSeek 大模型

  U->>F: 提交画像表单
  F->>A: POST /api/.../task/
  A->>Q: 创建任务并入队
  A-->>F: 202 返回任务号
  F->>F: 轮询任务状态
  Q->>W: 派发任务
  W->>L: 调用模型（JSON 约束）
  L-->>W: 结构化画像 JSON
  W->>W: 校验与容错解析
  W-->>Q: 写入任务结果
  F->>A: GET /api/.../result/{id}/
  A->>Q: 读取任务结果
  A-->>F: 返回结果 JSON
  F-->>U: 渲染十维画像 / 匹配结果
  Note over W,A: 超时或失败 → 降级为本地规则解析（结果如实标注）
```
