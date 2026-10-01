<template>
  <view class="node-detail-page">
    <!-- 内容滚动区域 -->
    <scroll-view
      class="content-scroll"
      scroll-y
      :style="{ paddingBottom: '30rpx' }"
    >
      <!-- Markdown 渲染容器 -->
      <view class="detail-container">
        <view class="detail-title">{{ formData.name }}</view>
        <view class="detail-content">
          <rich-text :nodes="renderedContent"></rich-text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { reactive, ref, onMounted } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { markedHighlight } from 'marked-highlight'

// ========== 1. Marked 配置初始化（代码高亮） ==========
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      // 无指定语言时使用纯文本高亮
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)

// ========== 2. 类型定义 ==========
interface TocItem {
  id: string
  title: string
  level: number
}

interface FormData {
  id: string
  name: string
  content: string
  [key: string]: any // 兼容其他字段
}

// ========== 3. 响应式数据 ==========
/**
 * 功能说明正文（Markdown）。
 *
 * 上游 Comuni 知识平台原本在这里内联了一份《Comuni 使用说明书 v0.0.2》，
 * 与本小程序「职途智行」的定位不符，因此整体替换为当前版本的功能说明。
 *
 * 撰写原则：只描述**已经实现**的功能，措辞与页面实际行为一致；
 * 尚未接入的能力（大模型解析、教师端 / 企业端等）不写入本说明书。
 */
const instructionMarkdown = `# 职途智行 使用说明书

## 一、产品介绍

职途智行是一款面向大学生的 **AI 就业能力提升与生涯规划** 小程序，以校招合作企业岗位为试点数据，帮助学生看清四件事：**岗位要什么**、**我有什么**、**差在哪里**、**接下来怎么补**。

围绕这条主线，平台提供四项核心能力：

1. **岗位能力画像** —— 把一段招聘信息拆解成十个维度的岗位要求
2. **学生就业能力画像** —— 把你的经历拆解成同一套十个维度的能力得分
3. **人岗智能匹配** —— 用同一把尺子比对，算出匹配度与具体缺口
4. **个性化生涯发展报告** —— 把前三步的结论变成一条可执行的成长路线

> 四项能力共用 **同一套十维基准**：专业技能、证书要求、创新能力、学习能力、抗压能力、沟通能力、实习能力、团队协作、逻辑思维、行业认知。这是匹配结果能够相互对照的前提。

---

## 二、快速入门

### 2.1 如何进入小程序

两种方式一键进入：

1. 微信首页下拉，搜索小程序名称，点击即可进入；
2. 扫描分享的小程序二维码，直接跳转进入。

### 2.2 注册与登录

平台提供两种登录方式，均不会泄露你的个人信息：

#### 方式一：微信一键登录（推荐）

1. 在「我的」页面点击「微信一键登录」；
2. 在微信授权弹窗中点击「允许」；
3. 授权完成后自动完成注册并登录，无需手动设置账号密码。

#### 方式二：账号密码登录

适合已有账号的用户：

1. 在「我的」页面点击「账号登录」；
2. 输入账号与密码，验证通过后即可进入。

> 提示：若登录失败，可先检查网络，切换 WiFi / 移动数据后重试；仍有问题请通过「我的 → 联系我们」反馈。

### 2.3 主界面总览

底部有四个核心导航：

| 导航栏 | 核心功能 |
| ------ | -------- |
| 首页 | 搜索平台内的知识库、文档与用户 |
| 能力画像 | 填写个人情况，生成十维就业能力画像 |
| AI 助手 | 围绕文章内容的智能问答 |
| 我的 | 个人中心：知识库、我的关注/粉丝、宣讲活动、功能说明、联系我们 |

---

## 三、核心功能使用指南

### 3.1 岗位能力画像（十维）

**入口**：我的 → 宣讲活动 → 选择一条招聘信息 → 岗位能力画像

系统会从招聘原文中抽取并量化十个维度的要求强度（0–100 分，**分数越高表示该岗位在这个维度上的门槛越高**），同时列出岗位明确写出的具体技能与证书，并区分「必须」与「优先」两类。

需要注意的两点：

- 招聘信息没有提到的维度会如实标注为「岗位未提要求」，这类维度不参与后续打分——既不给你加分，也不扣分；
- 画像来源会明确标注是「本地规则解析」还是「大模型解析」，不会把规则解析的结果当作模型输出展示。

### 3.2 学生就业能力画像（核心功能）

**入口**：底部导航「能力画像」

按三组内容填写即可：

1. **基本信息**：专业、年级、意向岗位、意向行业
2. **能力与证书**：掌握的技能、已取得或正在备考的证书
3. **经历补充**：项目经历、实习经历、获奖情况、成绩排名、自我评价

填写越具体，评分越可信。想先看效果，可点击右上角 **填入示例** 一键体验完整流程。

生成后你会得到：

- **十维能力得分**：每个维度给出分值、等级与判定依据；
- **能力星球图**：十个星球按分值决定大小与亮度，能力越强越大越亮；
- **职业徽章墙**：达到条件即点亮，例如「技能大师」「持证上岗」「六边形战士」；
- **信息完整度**：衡量你填得够不够全；
- **综合就业竞争力**：基于十维加权、并按信息完整度打折后的综合评分。

> 请区分两个分数：**信息完整度** 回答的是「你填了多少」，**综合竞争力** 回答的是「以你填写的内容看，你处在什么水平」。前者偏低不代表后者偏低，只说明这个结论的不确定性更大。

### 3.3 人岗智能匹配

**入口**：能力画像结果页 → 查看岗位匹配

系统会把你的十维画像与目标岗位的十维要求逐项比对，输出：

- **综合匹配度**与匹配等级；
- **四个类目**得分：专业技能、证书水平、实践经历、综合素质；
- **十维达成度**：逐项判断是否达到岗位要求；
- **技能 / 证书缺口**：区分「必须」与「优先」，并标出你已经具备的部分；
- **关键短板与提升建议**：直接告诉你应当先补哪一项。

> 设计说明：**岗位没有明确提要求的维度不参与打分**。这条规则是为了避免「要求写得越少的岗位反而越容易被匹配上」，让结果更接近真实的招聘门槛判断。

### 3.4 个性化生涯发展报告

**入口**：能力画像结果页 → 生涯发展报告

报告把前三个功能的结果串成一条完整链路：

1. **职业探索与人岗匹配分析** —— 你最匹配哪个岗位、依据是什么；
2. **职业目标与路径规划** —— 短期与长期目标、垂直晋升路径、跨岗换路方向，并标注这条路径是平滑、可过渡还是需要跨领域转向；
3. **分阶段成长计划** —— 短期（1–3 个月）、中期（4–12 个月）、长期（1 年以上）的具体任务；
4. **评估周期与动态调整机制** —— 第 1、3、6、12 个月分别该复盘什么。

报告支持：

- 勾选任务进度，完成情况会保存在本机，下次进入仍在；
- 复制全文与导出；
- 在「历史报告」中回看之前的版本，并与最新一次对比。

> 当你重新生成过能力画像后，再次打开报告会 **自动按新的画像重算**，不会继续显示旧结论。

### 3.5 知识库

**入口**：我的 → 知识库

用于收藏与管理就业政策、岗位资料、课程笔记等内容，支持新建知识库、撰写与编辑 Markdown 文档。在首页搜索到的公开文档，也可以一键 **复制到我的知识库**。

### 3.6 招聘信息与宣讲活动

**入口**：我的 → 宣讲活动

浏览校招合作企业的招聘岗位与企业信息。点进任一岗位即可查看它的能力画像，并以此发起人岗匹配。

---

## 四、常见问题

**Q：为什么匹配度没有到 100%？**

匹配度反映的是「你当前呈现出来的能力」与「岗位要求」之间的距离。画像只依据你填写的内容，没有写进简历的经历不会被计算。

**Q：为什么有的维度显示「岗位未提要求」？**

说明这条招聘信息没有在这个维度上提出可判定的要求。这类维度不参与打分，因此它既不会抬高也不会拉低你的匹配度。

**Q：评分和报告会一直不变吗？**

不会。修改并重新生成能力画像后，匹配结果与生涯发展报告都会按新的画像重算。

**Q：报告里的分数能当作求职承诺吗？**

不能。画像、匹配度与报告都是帮助你规划与准备的参考工具，不构成任何录用结果承诺。

**Q：登录失败了怎么办？**

先检查网络，切换 WiFi / 移动数据后重试；若仍然失败，请通过「我的 → 联系我们」反馈。

---

## 五、联系我们

使用中遇到问题、有功能建议或希望合作，欢迎通过「我的 → 联系我们」与我们取得联系。`

// 模拟 API 返回的数据（核心：content 字段为 Markdown 内容）
const mockApiData = {
  id: '648e9e6c-ec46-4263-b37b-5f3c4141066f',
  short_id: 'F2k3VPQo',
  name: '职途智行 使用说明书',
  content: instructionMarkdown,
  description: '',
  knowledge_base_id: '1de78b76-0d5d-44d7-9c7d-2ade2e4d83e0',
  knowledge_base_name: '功能说明',
}

// 页面核心数据
const formData = reactive<FormData>({
  id: '',
  name: '',
  content: '',
})
const renderedContent = ref('') // 解析后的 HTML 内容

// ========== 4. Markdown 核心处理逻辑 ==========
/**
 * 提取 Markdown 目录（根据标题生成锚点ID）
 */
const extractToc = (content: string): TocItem[] => {
  if (!content) return []
  const toc: TocItem[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*?)\s*$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      const id = `heading-${index}-${title.replace(/\s+/g, '-').toLowerCase()}`
      toc.push({ id, title, level })
    }
  })

  return toc
}

/**
 * Markdown 转 HTML（带样式类名、锚点、图片适配）
 */
const renderMarkdown = async (content: string): Promise<string> => {
  if (!content) return ''
  const tocItems = extractToc(content)
  const titleMap = new Map(tocItems.map((item) => [item.title, item.id]))

  // 解析 Markdown 为 HTML
  let html = await marked.parse(content)

  // 包裹基础容器 + 优化图片样式（适配移动端）
  html = `<div class="markdown-body">${html}</div>`
  // 适配图片：添加样式避免溢出
  html = html.replace(
    /<img(.*?)>/g,
    '<img $1 style="max-width: 100%; height: auto; border-radius: 8rpx; margin: 10rpx 0;" />',
  )

  // 为标题添加锚点ID和样式类
  html = html
    .replace(/<h1>(.*?)<\/h1>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h1-${Date.now()}`
      return `<h1 id="${id}" class="md-h1">${title}</h1>`
    })
    .replace(/<h2>(.*?)<\/h2>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h2-${Date.now()}`
      return `<h2 id="${id}" class="md-h2">${title}</h2>`
    })
    .replace(/<h3>(.*?)<\/h3>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h3-${Date.now()}`
      return `<h3 id="${id}" class="md-h3">${title}</h3>`
    })
    .replace(/<h4>(.*?)<\/h4>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h4-${Date.now()}`
      return `<h4 id="${id}" class="md-h4">${title}</h4>`
    })
    .replace(/<h5>(.*?)<\/h5>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h5-${Date.now()}`
      return `<h5 id="${id}" class="md-h5">${title}</h5>`
    })
    .replace(/<h6>(.*?)<\/h6>/g, (match, title) => {
      const cleanTitle = title.trim()
      const id = titleMap.get(cleanTitle) || `h6-${Date.now()}`
      return `<h6 id="${id}" class="md-h6">${title}</h6>`
    })
    // 为其他标签添加样式类
    .replace(/<p>/g, '<p class="md-p">')
    .replace(/<ul>/g, '<ul class="md-ul">')
    .replace(/<ol>/g, '<ol class="md-ol">')
    .replace(/<em>/g, '<em class="md-em">')
    .replace(
      /<blockquote>/g,
      '<blockquote class="md-blockquote" style="padding: 15rpx 20rpx; background: #f5f5f5; border-left: 4rpx solid #007aff; border-radius: 8rpx; margin: 15rpx 0;">',
    )
    .replace(
      /<table>/g,
      '<table class="md-table" style="width: 100%; border-collapse: collapse; margin: 20rpx 0;">',
    )
    .replace(/<tr>/g, '<tr style="border-bottom: 1rpx solid #eee;">')
    .replace(
      /<th>/g,
      '<th style="padding: 12rpx 8rpx; text-align: left; font-weight: 600; background: #f9f9f9;">',
    )
    .replace(/<td>/g, '<td style="padding: 12rpx 8rpx; font-size: 26rpx;">')
    .replace(
      /<pre>/g,
      '<pre class="md-pre" style="padding: 20rpx; background: #f7fafc; border-radius: 8rpx; overflow-x: auto; margin: 20rpx 0;">',
    )
    .replace(
      /<code>/g,
      '<code class="md-code" style="font-family: Consolas, Monaco, monospace; font-size: 28rpx; padding: 4rpx 8rpx; border-radius: 6rpx; background: #f6f6f6; color: #c7254e;">',
    )

  return html
}

// ========== 5. 数据初始化 ==========
/**
 * 模拟请求 API 并渲染 Markdown
 */
const fetchNodeDetail = async () => {
  try {
    // 模拟 API 请求（实际项目中替换为真实请求）
    // const res = await uni.request({
    //   url: 'https://youupro.xyz/api/v1/knowledge/nodes/648e9e6c-ec46-4263-b37b-5f3c4141066f/',
    //   method: 'GET'
    // })
    // const data = res.data

    // 使用模拟数据
    const data = mockApiData
    formData.id = data.id
    formData.name = data.name
    formData.content = data.content

    // 渲染 Markdown 内容
    renderedContent.value = await renderMarkdown(formData.content)
  } catch (error) {
    uni.showToast({ title: '加载失败', icon: 'none' })
    console.error('加载详情失败：', error)
  }
}

// ========== 6. 页面生命周期 ==========
onLoad(() => {
  fetchNodeDetail()
})

onMounted(() => {
  // 兜底：确保样式加载完成后渲染
  if (!renderedContent.value && formData.content) {
    renderMarkdown(formData.content).then((html) => {
      renderedContent.value = html
    })
  }
})
</script>

<style scoped lang="scss">
page {
  padding: 0;
  margin: 0;
  height: 100%;
  box-sizing: border-box;
  background-color: #f8f8f8;
}

.node-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

// 内容滚动区域
.content-scroll {
  flex: 1;
  padding: 20rpx 30rpx;
  padding-right: env(safe-area-inset-right) !important;
  padding-left: env(safe-area-inset-left) !important;
  overflow-y: auto;
  box-sizing: border-box;
}

// 详情容器
.detail-container {
  background-color: #ffffff;
  padding: 30rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  width: 100%;
  box-sizing: border-box;
}

.detail-title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
  color: #111;
  line-height: 1.4;
}

.detail-content {
  font-size: 28rpx;
  color: #222;
  line-height: 1.75;
  margin-bottom: 20rpx;
}

// ========== Markdown 样式 ==========
.markdown-body {
  width: 100%;
  box-sizing: border-box;
  line-height: 1.85;
  font-size: 28rpx;
  color: #222;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

// 标题样式
.md-h1 {
  font-size: 36rpx;
  font-weight: 700;
  margin: 30rpx 0 15rpx;
  padding-bottom: 10rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.md-h2 {
  font-size: 32rpx;
  font-weight: 600;
  margin: 25rpx 0 10rpx;
  padding-bottom: 8rpx;
  border-bottom: 1rpx solid #fafafa;
}

.md-h3 {
  font-size: 28rpx;
  font-weight: 600;
  margin: 20rpx 0 10rpx;
}

.md-h4 {
  font-size: 26rpx;
  font-weight: 600;
  margin: 18rpx 0 8rpx;
}

.md-h5 {
  font-size: 24rpx;
  font-weight: 600;
  margin: 15rpx 0 8rpx;
}

.md-h6 {
  font-size: 22rpx;
  font-weight: 600;
  color: #666;
  margin: 15rpx 0 8rpx;
}

// 段落样式
.md-p {
  margin: 15rpx 0;
  word-wrap: break-word;
}

// 列表样式
.md-ul,
.md-ol {
  margin: 15rpx 0;
  padding-left: 40rpx;
}

.md-ul li,
.md-ol li {
  margin: 8rpx 0;
  word-wrap: break-word;
}

// 引用块样式
.md-blockquote {
  font-size: 26rpx;
  color: #666;
  margin: 15rpx 0;
}

// 表格样式
.md-table {
  width: 100%;
  overflow-x: auto;
  margin: 20rpx 0;
}

// 代码块样式
.md-pre {
  margin: 20rpx 0;
  overflow-x: auto;
  background: #fbfbfb;
  border: 1rpx solid #f3f3f3;
  padding: 20rpx;
  border-radius: 10rpx;
}

// 行内代码样式
.md-code {
  padding: 4rpx 8rpx;
  border-radius: 6rpx;
  background-color: #f6f6f6;
  color: #c7254e;
  font-size: 24rpx;
}

// 分割线样式
.markdown-body hr {
  border: none;
  border-top: 1rpx solid #eee;
  margin: 30rpx 0;
}
</style>
