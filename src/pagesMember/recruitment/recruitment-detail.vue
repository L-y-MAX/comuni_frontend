<template>
  <view class="recruitment-detail-page">
    <!-- 悬浮刷新按钮 - 固定在屏幕右侧 -->
    <button
      class="refresh-btn"
      @click="refreshDetail"
    >
      <text class="refresh-text">刷新</text>
    </button>

    <scroll-view
      scroll-y
      class="detail-scroll"
    >
      <!-- 企业基本信息 - 通用折叠 -->
      <view class="collapse-container">
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('baseInfo')"
        >
          <text class="btn-text">企业基本信息</text>
        </view>
        <view
          class="collapse-content"
          :class="{ collapsed: !collapseStates.baseInfo }"
        >
          <view class="base-info-card card-style">
            <view class="info-item">
              <text class="label">企业名称：</text>
              <text
                class="value copy-item"
                @click="copyContent(detail.enterprise_name)"
                :selectable="true"
              >
                {{ detail.enterprise_name }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">统一信用代码：</text>
              <text
                class="value copy-item"
                @click="copyContent(detail.credit_code)"
                :selectable="true"
              >
                {{ detail.credit_code }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">企业性质：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.enterprise_nature }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">企业规模：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.enterprise_scale }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">所属行业：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.industry }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">公司地址：</text>
              <text
                class="value copy-item"
                @click="copyContent(detail.company_address)"
                :selectable="true"
              >
                {{ detail.company_address }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">校友企业：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.is_alumni_enterprise }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 企业简介 - 外层通用折叠 + 内部字符折叠 -->
      <view class="collapse-container">
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('introInfo')"
        >
          <text class="btn-text">企业简介</text>
        </view>
        <view
          class="collapse-content"
          :class="{ collapsed: !collapseStates.introInfo }"
        >
          <view class="intro-card card-style">
            <view class="intro-content-wrapper">
              <text
                class="intro-content"
                :selectable="true"
              >
                {{ isIntroExpanded ? detail.enterprise_intro : getCollapsedIntro }}
                <text
                  v-if="detail.enterprise_intro.length > 100"
                  class="toggle-btn"
                  @click="toggleIntroExpand"
                >
                  {{ isIntroExpanded ? '折叠' : '展开更多' }}
                </text>
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 招聘岗位信息 - 通用折叠 -->
      <view class="collapse-container">
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('jobInfo')"
        >
          <text class="btn-text">招聘岗位信息</text>
        </view>
        <view
          class="collapse-content"
          :class="{ collapsed: !collapseStates.jobInfo }"
        >
          <view class="job-card card-style">
            <view class="info-item">
              <text class="label">岗位名称：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.job_name }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">招聘专业：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.recruit_major }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">招聘人数：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.recruit_number }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">月薪范围：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.monthly_salary }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 岗位能力画像 - 跳转岗位画像页 -->
      <view class="collapse-container">
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('profileInfo')"
        >
          <text class="btn-text">岗位能力画像</text>
        </view>
        <view
          class="collapse-content"
          :class="{ collapsed: !collapseStates.profileInfo }"
        >
          <view class="profile-card card-style">
            <text class="profile-intro">
              对岗位文本做结构化解析，输出专业技能、证书要求、创新能力、学习能力等十大维度的能力要求画像，
              可直接用于人岗匹配与生涯发展报告生成。
            </text>
            <button
              class="profile-entry-btn"
              @click="goJobProfile"
            >
              查看岗位能力画像
            </button>
          </view>
        </view>
      </view>

      <!-- 联系方式 - 通用折叠 -->
      <view class="collapse-container">
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('contactInfo')"
        >
          <text class="btn-text">联系方式</text>
        </view>
        <view
          class="collapse-content"
          :class="{ collapsed: !collapseStates.contactInfo }"
        >
          <view class="contact-card card-style">
            <view class="info-item">
              <text class="label">联系人：</text>
              <text
                class="value copy-item"
                @click="copyContent(detail.contact_person || '无')"
                :selectable="true"
              >
                {{ detail.contact_person || '无' }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">联系电话：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.contact_phone || '无' }}
              </text>
              <button
                v-if="detail.contact_phone"
                class="call-btn"
                @click="makeCall(detail.contact_phone)"
              >
                拨打
              </button>
            </view>
            <view class="info-item">
              <text class="label">联系邮箱：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.email || '无' }}
              </text>
              <button
                v-if="detail.email"
                class="copy-btn"
                @click="copyEmail(detail.email)"
              >
                复制
              </button>
            </view>
          </view>
        </view>
      </view>

      <!-- 其他信息 - 通用折叠 -->
      <view class="collapse-container">
        <view
          class="collapse-trigger effect-btn"
          @click="toggleCollapse('otherInfo')"
        >
          <text class="btn-text">其他信息</text>
        </view>
        <view
          class="collapse-content"
          :class="{ collapsed: !collapseStates.otherInfo }"
        >
          <view class="other-card card-style">
            <view class="info-item">
              <text class="label">展位号：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.booth_number }}
              </text>
            </view>
            <view class="info-item">
              <text class="label">签到状态：</text>
              <text
                class="value"
                :selectable="true"
              >
                {{ detail.check_in_status }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 页面底部数据来源说明（移出折叠，全局固定在页面底部） -->
      <view class="page-footer-source">
        <text
          class="source-text"
          :selectable="true"
        >
          该数据由齐鲁人才网&聊城大学毕业生就业指导中心提供支持
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'

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
      url: `https://youupro.xyz/api/v1/employment/recruitments/?search=${encodeURIComponent(creditCode)}`,
      method: 'GET',
      header: {
        Authorization: `JWT ${uni.getStorageSync('accessToken')}`,
      },
    })

    const responseData = res.data as RecruitmentListResponse
    if (res.statusCode === 200 && responseData.results && responseData.results.length > 0) {
      detail.value = responseData.results[0]
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

// 跳转到岗位能力画像页（携带信用代码作为岗位标识）
const goJobProfile = () => {
  if (!currentCreditCode.value) {
    uni.showToast({
      title: '岗位信息未就绪',
      icon: 'none',
      duration: 2000,
    })
    return
  }
  uni.navigateTo({
    url: `/pagesMember/recruitment/job-profile?id=${encodeURIComponent(currentCreditCode.value)}`,
    fail: (err) => {
      console.error('跳转岗位画像失败：', err)
      uni.showToast({
        title: '跳转失败，请重试',
        icon: 'none',
        duration: 2000,
      })
    },
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
    imageUrl: 'https://youupro.xyz/notes/static/icons/recruit-detail-share.png', // 可选：分享卡片图片
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
    imageUrl: 'https://youupro.xyz/notes/static/icons/recruit-detail-share.png', // 可选：朋友圈分享图片
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
  --primary: #FF7239;
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
  background: linear-gradient(
    to right,
    transparent 1%,
    rgba(255, 69, 0, 0.15) 40%,
    rgba(255, 69, 0, 0.15) 60%,
    transparent 100%
  );
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
  background-color: #FF7239;
  color: #ffffff;
  font-size: 22rpx;
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
    background: radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 70%);
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
    font-size: 22rpx;
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
  background: #FF7239;
  color: #fff;
  border-radius: 6rpx;
  font-size: 24rpx;
  height: auto;
  line-height: 1.2;
  border: none;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;

  &::after {
    border: none;
  }
}

// ========== 岗位能力画像入口样式 ==========
.profile-card {
  display: flex;
  flex-direction: column;
}

.profile-intro {
  font-size: 25rpx;
  color: #6b7280;
  line-height: 1.7;
  display: block;
}

.profile-entry-btn {
  margin: 24rpx 0 0;
  height: 76rpx;
  line-height: 76rpx;
  background: #FF7239;
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
</style>
