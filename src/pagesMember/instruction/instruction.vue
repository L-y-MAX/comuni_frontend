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
// 模拟 API 返回的数据（核心：content 字段为 Markdown 内容）
const mockApiData = {
  id: '648e9e6c-ec46-4263-b37b-5f3c4141066f',
  short_id: 'F2k3VPQo',
  name: 'v0.0.2',
  content:
    '# Comuni（可优笔记）小程序使用说明书（v0.0.2）\r\n## 一、产品介绍\r\nComuni（可优笔记）是一款轻量化、全功能开放的Markdown共享知识平台。\r\n你可以用它轻松创作、编辑、管理个人Markdown笔记，也能浏览平台内其他用户公开分享的优质知识内容，结识同好创作者。**平台所有核心功能对所有用户开放，无任何付费功能墙，无功能使用门槛**。\r\n\r\n「尊贵会员」标识仅为对平台技术捐赠支持者的象征性荣誉标识，不附加额外功能特权，所有用户均可无差别使用平台全部能力。\r\n\r\n---\r\n\r\n## 二、快速入门（新用户必看）\r\n### 2.1 如何进入小程序\r\n两种方式一键进入：\r\n1. 微信首页下拉，在搜索框输入「Comuni可优笔记」，点击对应小程序即可进入；\r\n2. 扫描官方分享的小程序二维码，直接跳转进入。\r\n\r\n<img src="https://youupro.xyz/notes/nodes/tutorial/static/images/comuni.jpg" alt="comuni" style="zoom:50%;" />\r\n\r\n### 2.2 注册与登录\r\n平台提供两种登录方式，均安全合规，不会泄露你的个人信息：\r\n#### 方式一：微信一键登录（推荐）\r\n1. 进入小程序后，点击首页「微信一键登录」按钮；\r\n2. 在弹出的微信授权弹窗中，点击「允许」；\r\n3. 授权完成后自动完成注册+登录，直接进入平台主界面，无需手动设置账号密码。\r\n\r\n#### 方式二：账号密码登录(内测资格)\r\n适合已有平台账号的用户使用：\r\n1. 进入登录页，选择「账号密码登录」；\r\n2. 输入你注册的账号、密码；\r\n3. 点击「登录」按钮，验证通过后即可进入主界面。\r\n\r\n> 提示：若登录失败，可先检查手机网络是否正常，切换WIFI/移动数据后重试；仍有问题可查看文末「常见问题」或`联系我们`。\r\n\r\n### 2.3 主界面总览\r\n小程序底部有4个核心导航栏，覆盖全部使用场景：\r\n| 导航栏 | 核心功能                                 |\r\n| ------ | ---------------------------------------- |\r\n| 首页   | 搜索优质公开笔记，支持搜索内容/用户      |\r\n| 知识库 | 笔记编辑页，新建、编辑Markdown笔记，保存 |\r\n| AI助手 | 在文章内点击`问AI` 即可提问文章内容      |\r\n| 我的   | 个人中心，管理个人资料、关注、粉丝       |\r\n\r\n---\r\n\r\n## 三、核心功能详细使用指南\r\n### 3.1 笔记创作与管理（核心功能）\r\n平台原生支持完整Markdown语法，移动端也能轻松写出排版专业的笔记。\r\n\r\n#### 3.1.1 新建笔记\r\n1. 点击`我的知识库` `文章列表`导航栏「+」按钮，添加知识库/笔记；\r\n2. 输入笔记标题、正文内容，编辑器支持以下常用Markdown语法：\r\n   - 标题：# 一级标题、## 二级标题，最多支持6级标题\r\n   - 列表：有序列表（1. 2. 3.）、无序列表（- 内容）\r\n   - 格式：**加粗**、*斜体*、`行内代码`、> 引用块\r\n   - 图片：支持直接插入手机相册图片，自动生成Markdown图片链接\r\n\r\n#### 3.1.2 发布与保存\r\n- 「私有知识库保存」：仅自己可见，不会发布到知识广场，后续可继续编辑，适合存放个人私密笔记；\r\n- 「公开知识库发布」：笔记保存即同步到知识广场，其他用户可浏览、评论。\r\n\r\n#### 3.1.3 笔记管理\r\n1. 进入「知识库」-「我的知识库」，可查看你所有的知识库、公开、私密笔记；\r\n2. 点击单篇笔记，可进行「编辑」「修改发布状态」「删除」操作；\r\n3. 支持按标题、发布时间筛选笔记，快速找到目标内容。\r\n\r\n### 3.2 知识广场与内容浏览\r\n#### 3.2.1 浏览推荐内容\r\n1. 进入「首页」，即可看到平台推荐的优质公开笔记，下滑可无限加载；\r\n2. 点击单篇笔记，即可进入详情页查看完整内容，支持放大图片、复制文本。\r\n\r\n#### 3.2.2 搜索知识库/文章\r\n1. 点击首页顶部搜索框，输入关键词；\r\n2. 可选择「搜知识库」「搜笔记」「搜用户」两个维度，精准找到你需要的内容或创作者；\r\n3. 关注：将公开优质知识库加入`关注知识库`，后续在「知识库」-「关注/分享的知识库」中可快速查看；\r\n4. 将搜索到的文章复制到选择的`我的知识库`\r\n\r\n#### 3.2.3 内容互动\r\n在笔记详情页，你可以进行以下操作：\r\n- 评论：为优质内容提供宝贵意见，表达认可；\r\n- 问AI：点击作者头像，进入个人主页，点击「关注」按钮，即可持续收到该作者的新内容更新。\r\n- 一键复制优质文章编辑\r\n\r\n### 3.3 社交互动功能\r\n#### 3.3.1 关注与粉丝管理\r\n1. 进入「关注」页，可切换查看「关注列表」「粉丝列表」；\r\n2. 关注列表：查看你已关注的所有用户，点击可进入对方主页，也可直接「取消关注」；\r\n3. 粉丝列表：查看关注你的所有用户，可「移除粉丝」。\r\n\r\n### 3.4 个人中心与资料设置\r\n#### 3.4.1 个人资料修改（修改后重新登录）\r\n1. 进入「我的」页面，点击头像或「编辑资料」按钮，进入资料编辑页；\r\n2. 可修改以下信息：\r\n   - 头像：从手机相册选择图片上传\r\n   - 昵称：支持2-20位汉字、字母、数字、下划线，不可与其他用户重复\r\n   - 用户ID：支持8-32位字母、数字组合，不可与其他用户重复\r\n   - 个人简介：最多200字，介绍你的个人情况、知识库方向\r\n   - 性别、隐私设置：可设置账号是否为私密状态（私密账号的内容仅自己可见）\r\n3. 修改完成后，点击「保存」即可生效。\r\n\r\n#### 3.4.2 账号与安全\r\n- 绑定微信：可在「我的」-「账号安全」中绑定微信，后续可一键登录\r\n- 密码修改：账号密码登录的用户，可通过原密码修改新密码\r\n- 账号注销：可提交账号注销申请，7天冷静期后完成注销，所有数据将被清空。\r\n\r\n### 3.5 捐赠支持与会员标识\r\n#### 3.5.1 核心说明\r\n平台所有功能免费开放，无任何付费强制要求。「尊贵会员」标识仅为对平台支持者的象征性荣誉感谢，无任何额外功能特权，不影响正常使用。\r\n\r\n---\r\n\r\n## 四、常见问题（FAQ）\r\n### Q1：微信一键登录失败，提示“登录异常”怎么办？\r\nA：可按以下步骤排查：\r\n1. 检查手机网络是否正常，切换WIFI/移动数据后重试；\r\n2. 关闭小程序，从微信最近使用列表中移除，重新进入重试；\r\n3. 确认微信授权弹窗中点击了「允许」，未拒绝授权；\r\n4. 若仍无法解决，可通过官方邮箱联系我们处理。\r\n\r\n### Q2：捐赠后没有显示「尊贵会员」标识怎么办？\r\nA：\r\n1. 先确认是否在工作日处理时段，非工作时段会顺延至次日；\r\n2. 若超过24小时仍未显示，可发送邮件至skixkk7@163.com，附上「捐赠截图+你的注册邮箱/用户ID」，我们会在1个工作日内为你手动补充。\r\n\r\n### Q3：编辑的笔记内容丢失了怎么办？\r\nA：\r\n1. 建议编辑长笔记时，定期手动点击「保存」，避免意外情况导致内容丢失；\r\n\r\n### Q4：可以修改已经发布的笔记吗？\r\nA：完全可以。进入「知识库」-「有编辑权限的知识库」，找到需要修改的笔记，点击「<img src="https://youupro.xyz/notes/static/icons/compile.png" alt="编辑" style="zoom:25%;" />」按钮，修改完成后可重新选择发布状态，点击保存即可更新。\r\n\r\n### Q5：怎么让我的笔记不被其他人看到？\r\nA：\r\n1. 添加知识库时，选择「私有」，创建保存后仅自己可查看，不会出现在知识广场；\r\n\r\n### Q6：我的用户ID可以修改吗？有什么限制？\r\nA：可以修改。进入「我的」-「编辑资料」-「用户ID」即可修改，限制如下：\r\n1. 仅支持8-32位字母、数字组合，不支持特殊符号、汉字；\r\n2. 不可与平台内其他用户的ID重复；\r\n3. 修改后立即生效，原ID会被释放，其他人可注册使用。\r\n4. 退出登录，重新登录。\r\n\r\n---\r\n\r\n## 五、联系我们\r\n如果你在使用过程中遇到问题、有功能建议，或需要处理会员相关事宜，可通过以下方式联系我们：\r\n- 官方邮箱：skixkk7@163.com（工作日9:00-15:00内回复）',
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
