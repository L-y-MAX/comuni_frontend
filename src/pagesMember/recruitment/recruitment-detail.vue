<template>
  <view class="recruitment-detail-page">
    <scroll-view
      scroll-y
      class="detail-scroll"
    >
      <!-- 顶部岗位卡 -->
      <view class="detail-hero">
        <view class="hero-head">
          <text class="hero-job">{{ detail.job_name || '岗位信息' }}</text>
          <text class="hero-salary">{{ detail.monthly_salary || '薪资面议' }}</text>
        </view>
        <text class="hero-company">{{ detail.enterprise_name || '企业信息加载中' }}</text>

        <view class="hero-tags">
          <text v-if="detail.industry" class="hero-tag">{{ detail.industry }}</text>
          <text v-if="detail.enterprise_nature" class="hero-tag">{{ detail.enterprise_nature }}</text>
          <text v-if="detail.enterprise_scale" class="hero-tag">{{ detail.enterprise_scale }}</text>
          <text
            v-if="detail.is_alumni_enterprise === '是'"
            class="hero-tag alumni"
          >
            校友企业
          </text>
          <text
            v-if="matchScore"
            class="hero-tag match"
          >
            匹配 {{ matchScore }}%
          </text>
        </view>

        <view class="hero-actions">
          <button
            class="hero-match"
            @click="goJobMatch"
          >
            {{ matchScore ? '查看匹配结果' : '开始匹配' }}
          </button>
          <text class="hero-refresh" @click="refreshDetail">刷新</text>
        </view>
      </view>

      <!-- 岗位关键信息 -->
      <view class="detail-card">
        <text class="section-title">岗位信息</text>
        <view class="fact-grid">
          <view class="fact-item">
            <text class="fact-label">招聘人数</text>
            <text class="fact-value">{{ detail.recruit_number || '若干' }}</text>
          </view>
          <view class="fact-item">
            <text class="fact-label">招聘专业</text>
            <text class="fact-value">{{ detail.recruit_major || '不限' }}</text>
          </view>
        </view>
      </view>

      <!-- 岗位能力画像 -->
      <view class="detail-card">
        <view class="card-head">
          <text class="section-title">岗位能力画像</text>
          <text v-if="jobProfile" class="section-hint">十维要求</text>
        </view>

        <view v-if="profileLoading" class="profile-state">正在生成岗位画像…</view>
        <view v-else-if="profileError" class="profile-state">{{ profileError }}</view>
        <block v-else-if="jobProfile">
          <view
            v-for="dim in jobProfile.dimensions"
            :key="dim.key"
            class="profile-dim"
          >
            <view class="profile-dim-head">
              <text class="profile-dim-name">{{ dim.label }}</text>
              <text class="profile-dim-score">{{ dim.score }}</text>
            </view>
            <view class="profile-dim-track">
              <view
                class="profile-dim-fill"
                :style="{ width: `${dim.score}%` }"
              />
            </view>
            <text
              v-if="dim.skills?.length || dim.certificates?.length"
              class="profile-dim-meta"
            >
              <text v-if="dim.skills?.length">技能 {{ dim.skills.length }} 项</text>
              <text v-if="dim.certificates?.length">
                {{ dim.skills?.length ? ' · ' : '' }}证书 {{ dim.certificates.length }} 项
              </text>
            </text>
          </view>
        </block>
      </view>

      <!-- 企业信息 -->
      <view class="detail-card">
        <text class="section-title">企业信息</text>
        <view v-if="detail.credit_code" class="info-row">
          <text class="info-label">统一信用代码</text>
          <text
            class="info-value copy-value"
            @click="copyContent(detail.credit_code)"
          >
            {{ detail.credit_code }}
          </text>
        </view>
        <view v-if="detail.company_address" class="info-row">
          <text class="info-label">公司地址</text>
          <text
            class="info-value copy-value"
            @click="copyContent(detail.company_address)"
          >
            {{ detail.company_address }}
          </text>
        </view>

        <view v-if="detail.enterprise_intro" class="intro-block">
          <text class="intro-text">
            {{ isIntroExpanded ? detail.enterprise_intro : getCollapsedIntro }}
          </text>
          <text
            v-if="(detail.enterprise_intro || '').length > 100"
            class="intro-toggle"
            @click="toggleIntroExpand"
          >
            {{ isIntroExpanded ? '收起' : '展开全部' }}
          </text>
        </view>
      </view>

      <!-- 联系方式 -->
      <view class="detail-card">
        <text class="section-title">联系方式</text>

        <view v-if="detail.contact_person" class="contact-row">
          <uni-icons type="person" size="18" color="#5b616b" />
          <text class="contact-value">{{ detail.contact_person }}</text>
        </view>

        <view
          v-if="detail.contact_phone"
          class="contact-row"
          @click="makeCall(detail.contact_phone)"
        >
          <uni-icons type="phone" size="18" color="#5b616b" />
          <text class="contact-value">{{ detail.contact_phone }}</text>
          <text class="contact-action">拨打</text>
        </view>

        <view
          v-if="detail.email"
          class="contact-row"
          @click="copyEmail(detail.email)"
        >
          <uni-icons type="email" size="18" color="#5b616b" />
          <text class="contact-value">{{ detail.email }}</text>
          <text class="contact-action">复制</text>
        </view>

        <text
          v-if="!detail.contact_person && !detail.contact_phone && !detail.email"
          class="empty-text"
        >
          暂无联系方式
        </text>
      </view>

      <view class="page-footer-source">
        <text class="source-text">
          该数据由齐鲁人才网&聊城大学毕业生就业指导中心提供支持
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { baseURL } from '@/utils/request'
import { generateJobProfile } from './lib/jobProfileApi'
import type { JobProfile } from '@/types/jobProfile'

// 定义数据类型（和列表页一致）
interface RecruitmentItem {
  id: string | number
  enterprise_name: string
  credit_code: string
  enterprise_nature: string
  enterprise_scale: string
  enterprise_intro: string
  industry: string
  job_name: string
  recruit_major: string
  recruit_number: string
  monthly_salary: string
  contact_person: string
  contact_phone: string
  company_address: string
  booth_number: string
  check_in_status: string
  is_alumni_enterprise: string
  email: string
}

// 定义接口响应类型
interface RecruitmentListResponse {
  count: number
  next: string | null
  previous: string | null
  results: RecruitmentItem[]
}

// ========== 通用折叠状态管理 ==========
const collapseStates = ref<Record<string, boolean>>({
  baseInfo: true, // 企业基本信息默认展开
  introInfo: true, // 企业简介默认展开
  jobInfo: true, // 招聘岗位信息默认展开
  profileInfo: true, // 岗位能力画像默认展开
  contactInfo: true, // 联系方式默认展开
  otherInfo: true, // 其他信息默认展开
})

const toggleCollapse = (type: string) => {
  if (collapseStates.value[type] !== undefined) {
    collapseStates.value[type] = !collapseStates.value[type]
  }
}
// ========== 通用折叠状态管理结束 ==========

// 响应式数据
const detail = ref<RecruitmentItem>({} as RecruitmentItem)
const jobProfile = ref<JobProfile | null>(null)
const profileLoading = ref(false)
const profileError = ref('')
const matchScore = ref(0)

const readMatchScore = () => {
  try {
    const raw = uni.getStorageSync('jobMatchScores')
    const scores = raw && typeof raw === 'object' ? (raw as Record<string, number>) : {}
    matchScore.value = scores[currentCreditCode.value] || 0
  } catch {
    matchScore.value = 0
  }
}

onShow(readMatchScore)
const currentCreditCode = ref<string>('') // 存储当前信用代码
const isIntroExpanded = ref<boolean>(false) // 企业简介内部字符折叠状态

// 页面加载时获取参数
onLoad((options) => {
  // 接收列表页传来的 id 参数（信用代码）
  if (options?.id) {
    currentCreditCode.value = options.id
    fetchDetailById(options.id)
  } else {
    uni.showToast({
      title: '参数错误',
      icon: 'none',
      duration: 2000,
    })
    uni.navigateBack()
  }
})

// 根据信用代码获取详情数据（通过 search 参数搜索）
const fetchDetailById = async (creditCode: string) => {
  uni.showLoading({ title: '加载中...' })
  try {
    const res = await uni.request({
      url: `${baseURL}/api/v1/employment/recruitments/?search=${encodeURIComponent(creditCode)}`,
      method: 'GET',
      header: {
        Authorization: `JWT ${uni.getStorageSync('accessToken')}`,
      },
    })

    const responseData = res.data as RecruitmentListResponse
    if (res.statusCode === 200 && responseData.results && responseData.results.length > 0) {
      detail.value = responseData.results[0]
      loadJobProfile()
      // 每次加载数据重置折叠状态
      isIntroExpanded.value = false
      // 重置所有通用折叠状态
      collapseStates.value = {
        baseInfo: true,
        introInfo: true,
        jobInfo: true,
        profileInfo: true,
        contactInfo: true,
        otherInfo: true,
      }
    } else {
      uni.showToast({
        title: '未找到该招聘信息',
        icon: 'none',
        duration: 2000,
      })
      setTimeout(() => uni.navigateBack(), 1500)
    }
  } catch (err) {
    console.error('获取详情失败：', err)
    uni.showToast({
      title: '网络异常',
      icon: 'none',
      duration: 2000,
    })
  } finally {
    uni.hideLoading()
  }
}

// 刷新详情数据
const refreshDetail = async () => {
  if (!currentCreditCode.value) return
  await fetchDetailById(currentCreditCode.value)
  uni.showToast({
    title: '刷新成功',
    icon: 'none',
    duration: 2000,
  })
}

// 生成并内嵌岗位能力画像（本地规则，无网络）
const loadJobProfile = async () => {
  if (!detail.value.job_name) return
  profileLoading.value = true
  profileError.value = ''
  try {
    const result = await generateJobProfile({
      recruitment_id: detail.value.credit_code || String(detail.value.id || ''),
      job_name: detail.value.job_name,
      enterprise_name: detail.value.enterprise_name,
      industry: detail.value.industry,
      recruit_major: detail.value.recruit_major,
      monthly_salary: detail.value.monthly_salary,
      recruit_number: detail.value.recruit_number,
      enterprise_intro: detail.value.enterprise_intro,
    })
    jobProfile.value = result.profile
  } catch (err) {
    profileError.value = '岗位画像生成失败，请稍后重试'
    console.error('生成岗位画像失败：', err)
  } finally {
    profileLoading.value = false
  }
}

// 用当前岗位直接进入人岗匹配
const goJobMatch = () => {
  if (!currentCreditCode.value) return
  uni.navigateTo({
    url: `/pagesMember/jobMatch/jobMatch?id=${encodeURIComponent(currentCreditCode.value)}`,
    fail: () => uni.showToast({ title: '跳转失败，请重试', icon: 'none' }),
  })
}

// 切换企业简介内部字符展开/折叠状态
const toggleIntroExpand = () => {
  isIntroExpanded.value = !isIntroExpanded.value
}

// 获取折叠后的企业简介内容（100字符 + 省略）
const getCollapsedIntro = computed(() => {
  const intro = detail.value.enterprise_intro || ''
  if (intro.length <= 100) return intro

  // 截取100个字符
  return intro.substring(0, 100)
})

// 通用复制内容函数
const copyContent = (content: string) => {
  // 空值判断
  if (!content || content === '无') {
    uni.showToast({
      title: '暂无复制内容',
      icon: 'none',
      duration: 2000,
    })
    return
  }
  uni.setClipboardData({
    data: content,
    success: () => {
      uni.showToast({
        title: '复制成功',
        icon: 'success',
        duration: 2000,
      })
    },
    fail: () => {
      uni.showToast({
        title: '复制失败',
        icon: 'none',
        duration: 2000,
      })
    },
  })
}

// 拨打电话
const makeCall = (phone: string) => {
  uni.makePhoneCall({
    phoneNumber: phone,
    fail: () => {
      uni.showToast({
        title: '拨打电话失败',
        icon: 'none',
        duration: 2000,
      })
    },
  })
}

// 复制邮箱
const copyEmail = (email: string) => {
  copyContent(email) // 复用通用复制函数
}

// ========== 微信小程序分享功能 ==========
// 分享给好友（胶囊按钮三点菜单触发）
onShareAppMessage(() => {
  // 拼接分享标题，优先显示企业+岗位名称
  const shareTitle =
    detail.value.enterprise_name && detail.value.job_name
      ? `${detail.value.enterprise_name} - ${detail.value.job_name}招聘信息`
      : '优质招聘岗位详情'
  // 构建分享路径，携带信用代码作为 id 参数
  const sharePath = `/pagesMember/recruitment/recruitment-detail?id=${currentCreditCode.value}`

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl:
      'https://youupro.xyz/notes/static/icons/recruit-detail-share.png', // 可选：分享卡片图片
    desc: '查看详细的企业招聘信息，包含薪资、岗位要求等内容', // 可选：分享描述
  }
})

// 分享到朋友圈（胶囊按钮三点菜单触发）
onShareTimeline(() => {
  // 拼接朋友圈分享标题
  const timelineTitle =
    detail.value.enterprise_name && detail.value.job_name
      ? `${detail.value.enterprise_name}正在招聘${detail.value.job_name}岗位，速看！`
      : '优质招聘岗位详情分享'
  // 分享路径与好友分享保持一致，确保打开相同详情页
  const sharePath = `/pagesMember/recruitment/recruitment-detail?id=${currentCreditCode.value}`

  return {
    title: timelineTitle,
    path: sharePath,
    imageUrl:
      'https://youupro.xyz/notes/static/icons/recruit-detail-share.png', // 可选：朋友圈分享图片
  }
})
</script>

<style scoped lang="scss">
// ========== 通用折叠/展开样式（新特效 + 保留橙红色主题 + 缩短按钮） ==========
// 折叠容器样式
.collapse-container {
  position: relative;
  z-index: 3;
  margin-bottom: 20rpx;
}

// 折叠触发按钮样式
.collapse-trigger {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 按钮样式（核心修改：高度减小1/3 + 纯白背景 + 无阴影）
.effect-btn {
  --primary: #ff7239;
  --primary-light: #ff9a7a;
  font-size: 26rpx;
  padding: 0 40rpx; /* 固定左右内边距，宽度由内容决定 */
  letter-spacing: 0.06em;
  position: relative;
  font-family: inherit;
  border-radius: 20rpx;
  overflow: hidden;
  transition: all 0.3s;
  line-height: 48rpx; /* 高度减小1/3：72rpx → 48rpx */
  border: 2rpx solid var(--primary);
  background: #ffffff; /* 纯白背景，和卡片一致 */
  color: var(--primary);
  width: auto; /* 取消满屏宽度，自适应内容 */
  height: 48rpx; /* 高度减小1/3 */
  margin: 0 auto; /* 按钮居中 */
  text-align: center;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent; /* 彻底取消点击高亮 */
  z-index: 10;
}

// 点击时的样式（删除灰色背景）
.effect-btn:active {
  color: var(--primary-light);
  background: #ffffff; /* 保持纯白背景，无灰色 */
}

// 滑动光效伪元素
.effect-btn:before {
  content: '';
  position: absolute;
  left: -120rpx;
  width: 120rpx;
  height: 100%;
  top: 0;
  transition: transform 0.4s ease-in-out;
  background: transparent;
}

// 点击时光效滑动
.effect-btn:active:before {
  transform: translateX(400rpx);
}

// 按钮文字样式
.effect-btn .btn-text {
  position: relative;
  z-index: 11;
  color: var(--primary);
  transition: all 0.3s ease-in;
}

.effect-btn:active .btn-text {
  color: var(--primary-light);
}

// 折叠内容容器样式
.collapse-content {
  overflow: hidden;
  transition: all 0.5s ease;
  height: auto;
  position: relative;
  z-index: 4;
  margin-top: 12rpx; /* 按钮和内容之间增加间距 */
}

// 折叠状态样式（收起时仅显示分隔线）
.collapse-content.collapsed {
  height: 2rpx;
  width: 300rpx; /* 分隔线宽度和按钮匹配 */
  margin: 8rpx auto 0; /* 分隔线居中 */
  background-color: #e5e7eb;
  border-radius: 1rpx;

  .card-style {
    display: none;
  }
}

// 通用卡片样式（新增边框 + 删除阴影）
.card-style {
  transform: translateY(0);
  transition: all 0.3s ease;
  position: relative;
  z-index: 4;
  border: 1rpx solid #e5e7eb;
  margin: 0 20rpx; /* 卡片左右增加边距，避免贴边 */
}
// ========== 通用折叠/展开样式结束 ==========

.recruitment-detail-page {
  min-height: 100vh;
  background: #f8fafc;
  position: relative; // 作为悬浮按钮的定位容器
  -webkit-tap-highlight-color: transparent; // 全局取消微信默认的点击高亮特效
  padding: 0 20rpx; // 给页面整体添加左右内边距，避免内容贴边
}

// 悬浮刷新按钮 - 固定在屏幕右侧
.refresh-btn {
  position: fixed; // 固定定位，脱离文档流
  right: 20rpx; // 距离屏幕右侧20rpx
  top: 20rpx; // 距离屏幕顶部20rpx
  z-index: 999; // 确保在最上层
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 20rpx;
  border: 2rpx solid #e03e00;
  background-color: #ff7239;
  color: #ffffff;
  font-size: 28rpx;
  cursor: pointer;
  border-radius: 16rpx;
  transition: all 0.4s ease;
  outline: none;
  overflow: hidden;
  font-weight: bold;
  height: 45rpx;
  min-width: 100rpx;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  // 重置uni-app button默认样式
  &::after {
    border: none;
  }

  // 伪元素渐变效果
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.25);
    transform: scale(0);
    transition: transform 0.5s ease;
    pointer-events: none;
  }

  // 点击效果
  &:active::after {
    transform: scale(4);
  }

  &:active {
    border-color: #ff7a4d;
    background: #e03e00;
  }

  // 文字样式
  .refresh-text {
    font-size: 24rpx;
    font-weight: bold;
  }
}

// 滚动区域 - 适配悬浮按钮，顶部留出空间
.detail-scroll {
  height: 100vh;
  padding: 20rpx 0 40rpx; // 底部增加内边距，给数据源说明留出空间
  padding-right: 140rpx; // 右侧留出按钮空间，避免内容被遮挡
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  max-width: 750rpx; // 限制最大宽度，适配不同屏幕
  margin: 0 auto; // 居中显示
}

// 卡片统一样式优化（删除阴影）
.base-info-card,
.intro-card,
.job-card,
.contact-card,
.other-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 0;
  max-width: 100%;
  box-sizing: border-box;
}

// 企业简介内容容器
.intro-content-wrapper {
  width: 100%;
  display: block;
}

// 内部展开/折叠按钮样式（删除点击灰色）
.toggle-btn {
  color: #ff4500;
  font-size: 26rpx;
  font-weight: 500;
  margin-left: 8rpx;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  display: inline-block;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  background-color: transparent; /* 透明背景，无灰色 */

  &:active {
    background-color: transparent; /* 点击时保持透明，无灰色 */
  }
}

// 可点击复制的文本样式
.copy-item {
  position: relative;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background-color: transparent; /* 点击时无灰色 */
  }
}

.info-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
  gap: 8rpx;
}

.info-item:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 28rpx;
  color: #6b7280;
  width: 160rpx;
  flex-shrink: 0;
  text-align: right;
  padding-right: 12rpx;
}

.value {
  font-size: 28rpx;
  color: #1f2937;
  flex: 1;
  word-break: break-all;
  max-width: calc(100% - 180rpx);
  padding-right: 10rpx;
}

// 企业简介内容特殊处理
.intro-content {
  font-size: 28rpx;
  color: #1f2937;
  line-height: 1.6;
  padding: 8rpx 0;
  word-break: break-all;
  padding-right: 10rpx;
  display: block;
  width: 100%;
}

// 拨打/复制按钮样式（主题色）
.call-btn,
.copy-btn {
  margin-left: 15rpx;
  padding: 4rpx 12rpx;
  background: #ff7239;
  color: #fff;
  border-radius: 6rpx;
  font-size: 28rpx;
  height: auto;
  line-height: 1.2;
  border: none;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;

  &::after {
    border: none;
  }
}

// ========== 岗位能力画像 ==========
.profile-card {
  display: flex;
  flex-direction: column;
}

.profile-state {
  padding: 20rpx 0;
  font-size: 26rpx;
  color: #6b7280;
}

.profile-dim {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f2f3f5;
}

.profile-dim-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.profile-dim-name {
  font-size: 26rpx;
  color: #1f2937;
}

.profile-dim-score {
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
}

.profile-dim-track {
  height: 6rpx;
  margin-top: 8rpx;
  background: #f1f5f9;
  border-radius: 3rpx;
  overflow: hidden;
}

.profile-dim-fill {
  height: 100%;
  background: #ff8558;
  border-radius: 3rpx;
}

.profile-dim-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.profile-match-btn {
  margin: 24rpx 0 0;
  height: 76rpx;
  line-height: 76rpx;
  background: #ff8558;
  color: #fff;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;

  &::after {
    border: none;
  }
}

// ========== 页面底部数据源说明样式 ==========
.page-footer-source {
  text-align: center;
  padding: 20rpx 30rpx 40rpx;
  margin-top: 10rpx;
}

.page-footer-source .source-text {
  font-size: 24rpx;
  color: #9ca3af;
  // 核心修改：文字斜体
  font-style: italic;
  line-height: 1.5;
}
/* ====================== 岗位详情新版 ====================== */
.detail-scroll {
  padding: 20rpx 0 40rpx;
  box-sizing: border-box;
}

.detail-hero {
  padding: 28rpx;
  margin-bottom: 16rpx;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 20rpx;
}

.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.hero-job {
  flex: 1;
  min-width: 0;
  padding-right: 20rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #17191c;
  line-height: 1.35;
}

.hero-salary {
  flex: none;
  font-size: 34rpx;
  font-weight: 600;
  color: #ff8558;
}

.hero-company {
  display: block;
  margin-top: 8rpx;
  font-size: 27rpx;
  color: #5b616b;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 14rpx;
}

.hero-tag {
  margin: 0 12rpx 8rpx 0;
  padding: 4rpx 12rpx;
  font-size: 24rpx;
  color: #5b616b;
  background: #f7f8fa;
  border-radius: 6rpx;
}

.hero-tag.alumni {
  color: #b23c17;
  background: #fff3ed;
}

.hero-tag.match {
  color: #b23c17;
  background: #fff3ed;
  font-weight: 500;
}

.hero-actions {
  display: flex;
  align-items: center;
  margin-top: 18rpx;
}

.hero-match {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  margin: 0;
  padding: 0;
  font-size: 27rpx;
  font-weight: 600;
  color: #ffffff;
  background: #ff8558;
  border-radius: 10rpx;

  &::after {
    border: none;
  }
}

.hero-refresh {
  margin-left: 24rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.detail-card {
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 16rpx;
}

.section-title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #17191c;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.section-hint {
  font-size: 24rpx;
  color: #9aa0a8;
}

.fact-grid {
  display: flex;
  flex-wrap: wrap;
}

.fact-item {
  width: 50%;
  padding: 10rpx 0;
}

.fact-label {
  display: block;
  font-size: 24rpx;
  color: #9aa0a8;
}

.fact-value {
  display: block;
  margin-top: 4rpx;
  font-size: 27rpx;
  color: #17191c;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12rpx 0;
}

.info-label {
  flex: none;
  width: 200rpx;
  font-size: 25rpx;
  color: #9aa0a8;
}

.info-value {
  flex: 1;
  text-align: right;
  font-size: 25rpx;
  color: #17191c;
  line-height: 1.6;
  word-break: break-all;
}

.copy-value {
  color: #5b616b;
}

.intro-block {
  margin-top: 12rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f2f3f5;
}

.intro-text {
  display: block;
  font-size: 26rpx;
  line-height: 1.8;
  color: #5b616b;
  white-space: pre-wrap;
}

.intro-toggle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #ff8558;
}

.contact-row {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f7f8fa;
}

.contact-row:last-child {
  border-bottom: none;
}

.contact-value {
  flex: 1;
  margin-left: 14rpx;
  font-size: 26rpx;
  color: #17191c;
}

.contact-action {
  flex: none;
  margin-left: 16rpx;
  font-size: 24rpx;
  color: #ff8558;
}

.empty-text {
  font-size: 24rpx;
  color: #9aa0a8;
}

</style>
