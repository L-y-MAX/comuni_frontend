# 职途智行（Navir Career）

面向大学生的 **AI 就业能力提升与生涯规划** 微信小程序。

把「招聘要求」和「个人能力」放到**同一套十维基准**上比对，帮学生看清四件事：

> **岗位要什么** · **我有什么** · **差在哪里** · **接下来怎么补**

以校招合作企业岗位为试点数据，从「看懂岗位」一路串到「知道下一步做什么」。

---

## 一、四项核心能力

| # | 功能 | 做什么 | 入口 |
| --- | --- | --- | --- |
| 1 | **岗位能力画像** | 把一段招聘信息拆成十个维度的要求强度（0–100），并列出「必须 / 优先」的具体技能与证书 | 首页 → 岗位招聘（或 首页 → 岗位能力画像） |
| 2 | **学生就业能力画像** | 把个人经历拆成同一套十维得分，输出能力星球图、职业徽章墙、信息完整度与综合就业竞争力 | 底部导航「能力画像」 |
| 3 | **人岗智能匹配** | 两套画像逐项比对，给出综合匹配度、四类目得分、十维达成度、技能/证书缺口与提升建议 | 能力画像结果页 → 查看岗位匹配 |
| 4 | **个性化生涯发展报告** | 职业路径规划（垂直晋升 + 跨岗换路）+ 分阶段成长计划 + 评估节点与动态调整 | 能力画像结果页 → 生涯发展报告 |

另有两个求职资源类功能：

- **岗位招聘** —— 浏览校招合作企业的招聘岗位与企业信息，点进任一岗位可查看它的能力画像
- **就业政策与校招资源** —— 离线可用的结构化资源库（就业政策 / 校招企业名单 / 简历与面试指导）

### 十维基准（两侧共用）

```
专业技能 · 证书要求 · 创新能力 · 学习能力 · 抗压能力
沟通能力 · 实习能力 · 团队协作 · 逻辑思维 · 行业认知
```

岗位侧与个人侧**共用同一份维度定义**（`src/types/jobProfile.ts` 的 `JOB_DIMENSIONS`），
这是匹配结果能够相互对照的前提。两侧分值区间一致（0–100），但语义相反：

- 岗位分高 = 该维度**门槛高**
- 个人分高 = 该维度**能力强**

---

## 二、技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | uni-app 3.0（`@dcloudio/uni-app`）+ Vue 3.5 + TypeScript |
| 状态管理 | Pinia（含 `pinia-plugin-persistedstate`） |
| 构建 | Vite |
| Markdown 渲染 | marked + highlight.js |
| 目标平台 | 微信小程序（`mp-weixin`），同时保留 uni-app 其他平台的编译配置 |

---

## 三、快速开始

### 3.1 安装依赖

```bash
npm install      # 或 pnpm install
```

### 3.2 开发（微信小程序，带热更新）

```bash
npm run dev:mp-weixin
```

产物输出到 `dist/dev/mp-weixin`。

### 3.3 发布构建

```bash
npm run build:mp-weixin
```

产物输出到 `dist/build/mp-weixin`。

### 3.4 用微信开发者工具打开

> ⚠️ **必须导入 `dist/dev/mp-weixin`（或 `dist/build/mp-weixin`），不要导入仓库根目录。**
> 根目录没有 `project.config.json`，导进去会报「在项目根目录未找到 app.json」。

> ⚠️ **导入后请在「详情 → 本地设置」里关闭「编译热重载」。**
> `uni` 的构建会整体删除并重建 `dist/dev/mp-weixin`；热重载走增量更新，
> 会在目录被清空的瞬间读取失败，报
> `The file app.json doesn't exist` → `routeTo appLaunch timeout`，小程序起不来，
> 界面停在上一次的渲染结果上。

更完整的开发环境说明、编译开关与常见坑，见仓库根目录的 **`开发环境说明.md`**。

---

## 四、目录结构

```
comuni_frontend/
├─ src/
│  ├─ pages/                  # 主包页面（tabBar 页面必须在主包）
│  │  ├─ index/               # 首页：搜索 + 四个快捷入口
│  │  ├─ abilityProfile/      # 能力画像（tabBar，含隐藏式功能侧边栏）
│  │  ├─ ai/                  # AI 助手（tabBar）
│  │  ├─ my/                  # 我的（tabBar）
│  │  └─ knowledge/           # 知识库
│  ├─ pagesMember/            # 分包页面（19 个分包）
│  │  ├─ recruitment/         # 招聘列表 / 详情 / 岗位能力画像
│  │  ├─ jobMatch/            # 人岗智能匹配
│  │  ├─ careerReport/        # 生涯发展报告
│  │  ├─ reportHistory/       # 历史报告
│  │  ├─ careerResources/     # 就业政策与校招资源
│  │  ├─ instruction/         # 功能说明（使用说明书）
│  │  └─ …                    # 登录 / 知识库编辑 / 关注 / 会员等
│  ├─ types/                  # 数据模型与常量（维度定义、接口契约）
│  ├─ utils/                  # 纯逻辑：解析器、匹配算法、资源数据
│  ├─ api/                    # 接口封装（含「接口不可用 → 本地降级」）
│  ├─ static/                 # 本地静态资源（tabBar 图标、首页卡片图标）
│  ├─ pages.json              # 页面注册与 tabBar 配置
│  └─ manifest.json           # 小程序 appid 与编译配置
├─ README/                    # 文档图片（可放项目截图）
├─ 开发环境说明.md
└─ dist/                      # 构建产物（已 gitignore）
```

---

## 五、模块与文件对应关系

只列出本项目的就业能力相关模块（其余为知识平台原有代码）。

| 功能 | 数据模型 | 纯逻辑 | 接口 | 页面 |
| --- | --- | --- | --- | --- |
| 岗位能力画像 | `types/jobProfile.ts` | `utils/jobProfileParser.ts` | `api/jobProfile.ts` | `pagesMember/recruitment/job-profile.vue` |
| 学生就业能力画像 | `types/studentProfile.ts` | `utils/studentProfileParser.ts`、`utils/abilityPlanet.ts` | `api/studentProfile.ts` | `pages/abilityProfile/abilityProfile.vue` |
| 人岗智能匹配 | `types/jobMatch.ts` | `utils/jobMatch.ts` | — | `pagesMember/jobMatch/jobMatch.vue` |
| 生涯发展报告 | `types/careerReport.ts` | `pagesMember/careerReport/lib/careerReport.ts`、`lib/jobGraph.ts` | `pagesMember/careerReport/lib/careerReportApi.ts` | `pagesMember/careerReport/careerReport.vue` |
| 历史报告 | `utils/reportHistory.ts` | — | — | `pagesMember/reportHistory/reportHistory.vue` |
| 就业政策与校招资源 | `types/careerResource.ts` | `utils/careerResources.ts` | — | `pagesMember/careerResources/careerResources.vue` |
| 功能侧边栏 | — | `utils/featureNav.ts` | — | 能力画像页内 |

**分层原则**：`types` 只放类型与常量，`utils` 只放纯函数（可在 Node 里直接单测），
`api` 负责网络与降级，页面只做渲染与交互编排。

---

## 六、设计取舍与已知限制

### 6.1 大模型解析未就绪时降级到本地规则

后端 `/api/v1/employment/job-profile/parse/task/` 等画像接口尚未实现。
前端在接口 404 / 超时 / 结构不合法时**静默降级**为本地关键词规则解析，
并在页面上**如实标注**来源是「本地规则解析」还是「大模型解析」——
不会把规则结果伪装成大模型结果。

因此当前看到的画像由关键词规则生成，识别不了同义表述与隐含要求，
`professional_skill` / `certificate` 之外的软性维度置信度天然偏低。

### 6.2 匹配算法的两条关键规则

1. **岗位没有明确提要求的维度不参与打分**。早先的实现把这类维度算满分，
   导致「要求写得越少的岗位反而越容易被匹配上」。
2. **核心技能不达标时设总评上限**。专业技能一项都不具备时，
   不会因为其他项都是满分就被判成「基本匹配」。

> ⚠️ 计划书中的「匹配准确率 ≥85%」目前**没有验证**，
> 需要真实标注数据做回归才能宣称，本项目不作保证。

### 6.3 就业政策资源库只做「来源 + 定位 + 官方链接」

不转载政策与校方文件原文，也不写入未经核对的补贴金额、申领条件与时限。
每条资源都带来源角标（官方文件 / 官方平台 / 媒体报道 / 平台整理）与官方链接。

### 6.4 踩过的坑（写在这里避免重复踩）

- **tabBar 图标文件名必须与 `pages.json` 里的 `iconPath` 逐字一致**。
  微信会校验整个 tabBar，任一图标文件找不到就会让**全部**图标不渲染
  （报 `checkTabbar` 错误）。文件名里多一个空格就会触发。
- **本地静态资源放 `src/static/`，不要放 `dist/`**。`dist` 每次构建都会被清空。
- **tabBar 页面只能 `switchTab`**，普通页面只能 `navigateTo`，用错会静默失败。
- **`position: sticky` 在 scroll-view 里不可靠**，本项目的吸顶导航用
  `position: fixed` + 动态 `paddingTop` 实现。
- **只被一个分包用到的模块，要放进那个分包的目录里**。微信不允许分包之间互相
  `require`，而 uni-app 的分包优化**不会**搬运 `src/utils`、`src/api` 这类共享
  目录下的源码 —— 放在共享目录里就会一直占主包体积。分包只能引用「主包」和
  「自己分包目录内」的文件，所以 `pagesMember/careerReport/lib/` 下的模块
  可以在该分包任意页面里直接引用，但**不要搬到别处**。
  反过来，被 ≥2 个分包共用的模块（如 `utils/jobMatch.ts`、`utils/jobProfileSamples.ts`）
  必须留在主包，这是架构约束而非冗余。

---

## 七、开发约定

- **提交信息**：`type(scope): :emoji: 说明`，例如
  `feat(job-profile): :sparkles: 选岗列表新增搜索`
- **改动原则**：一个提交只做一件事，功能改动与样式整理分开提交
- **注释语言**：中文，重点解释「为什么这么做」而不是「做了什么」

---

## 八、开源许可

本项目在 [Comuni 知识平台](https://github.com/Skixkk/comuni_frontend) 的代码基础上扩展而来，
原项目采用 **MIT License**（见 `LICENSE`，Copyright (c) 2025 Ski）。

在此基础上新增的就业能力相关模块（岗位画像、能力画像、人岗匹配、生涯报告、
就业政策资源库等）同样以 MIT 协议开源。
