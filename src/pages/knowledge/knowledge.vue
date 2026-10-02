<template>
  <view class="knowledge-page">
    <!-- 首次进入的整页加载占位（后续操作不再让整页闪烁） -->
    <view
      v-if="firstLoading"
      class="loading-container"
    >
      <uni-load-more
        type="loading"
        text="加载中..."
      />
    </view>

    <!-- 知识库分栏容器 -->
    <view
      v-else
      class="kb-container"
    >
      <!-- 分栏切换按钮 -->
      <view class="kb-tab-header">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'left' }"
          @click="switchTab('left')"
        >
          关注/分享的知识库
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'right' }"
          @click="switchTab('right')"
        >
          我的知识库
        </button>
      </view>

      <!-- 一句话概览：数量取自实际列表，不编造 -->
      <view class="kb-overview">
        <text class="kb-overview-num">{{ kbTotal }} 个知识库</text>
        <text class="kb-overview-sub">
          {{ activeTab === 'right' ? '我创建的' : '关注与分享给我的' }}
        </text>
      </view>

      <!-- 使用引导：首次进入默认展开，用户收起后记住选择 -->
      <view class="guide-card">
        <view
          class="guide-head"
          @click="toggleGuide"
        >
          <view class="guide-head-left">
            <image
              class="guide-icon"
              src="/static/home/knowledge.png"
              mode="aspectFit"
            />
            <text class="guide-title">知识库怎么用</text>
          </view>
          <text class="guide-toggle">{{ guideCollapsed ? '展开' : '收起' }}</text>
        </view>
        <view
          v-if="!guideCollapsed"
          class="guide-body"
        >
          <view class="guide-step">
            <text class="guide-num">1</text>
            <text class="guide-text">在「我的知识库」点右上角 ＋ 新建一个知识库</text>
          </view>
          <view class="guide-step">
            <text class="guide-num">2</text>
            <text class="guide-text"
              >选中这个知识库，点「新增文章」。正文支持 Markdown：标题、列表、表格、代码块</text
            >
          </view>
          <view class="guide-step">
            <text class="guide-num">3</text>
            <text class="guide-text"
              >保存后在文章详情页右上角点「问 AI」，可以让它概括要点、解释代码、出面试题</text
            >
          </view>
          <view class="guide-step">
            <text class="guide-num">4</text>
            <text class="guide-text"
              >把知识库分享给同学，也可以在别人的主页关注他的知识库</text
            >
          </view>
          <view class="guide-tip"
            >不知道写什么？「新增文章」页里有一键「插入示例模板」，会填好一段演示内容。</view
          >
        </view>
      </view>

      <!-- 分栏内容区域 -->
      <view class="kb-columns">
        <!-- 左侧栏：关注的知识库 + 分享给我的知识库 -->
        <view
          class="kb-column left-column"
          v-if="activeTab === 'left'"
        >
          <!-- 关注的知识库 -->
          <view class="kb-section">
            <view class="kb-header">
              <text class="title">关注的知识库</text>
              <view class="kb-header-actions">
                <button
                  class="fold-button"
                  @click="toggleFollowKbExpand"
                >
                  <image
                    class="fold-icon"
                    :src="
                      isFollowKbExpanded
                        ? 'https://youupro.xyz/notes/static/icons/fold-default.png'
                        : 'https://youupro.xyz/notes/static/icons/fold-selected.png'
                    "
                    mode="aspectFit"
                  />
                </button>
              </view>
            </view>

            <view v-if="isFollowKbExpanded">
              <!--增加可选链保护 length 访问 -->
              <view
                v-if="followKbList?.length === 0"
                class="empty-tip"
              >
                <text>暂无关注的知识库</text>
              </view>
              <!--遍历前确保数组存在 -->
              <view
                class="kb-item"
                v-for="item in followKbList || []"
                :key="`follow-${item.id}`"
                :class="{ active: tabState[activeTab].selectedKbId === item.id }"
              >
                <view
                  class="kb-info"
                  @click="selectKb(item.id)"
                >
                  <!-- 核心修改：将公开/私有标签与名称放在同一行，标签在前 -->
                  <view class="kb-name-row">
                    <text
                      class="kb-public"
                      v-if="item.is_public"
                    >
                      公开
                    </text>
                    <text
                      class="kb-private"
                      v-else
                    >
                      私有
                    </text>
                    <text class="kb-name">{{ item.name }}</text>
                  </view>
                  <text class="kb-desc">
                    <text
                      v-if="item.creator_username"
                      class="kb-author"
                    >
                      @{{ item.creator_username }}
                    </text>
                    <text v-if="item.creator_username && item.description"> · </text>{{ item.description || '' }}
                  </text>
                </view>
                <!-- 新增：取消关注按钮 -->
                <view
                  class="kb-more"
                  @click.stop="openKbActions(item, 'followed')"
                >
<image
                    class="kb-more-icon"
                    src="/static/icons/three.png"
                    mode="aspectFit"
                  />
                </view>
              </view>
            </view>
          </view>

          <!-- 分享给我的知识库 -->
          <view class="kb-section">
            <view class="kb-header">
              <text class="title">分享给我的知识库</text>
              <view class="kb-header-actions">
                <button
                  class="fold-button"
                  @click="toggleShareKbExpand"
                >
                  <image
                    class="fold-icon"
                    :src="
                      isShareKbExpanded
                        ? 'https://youupro.xyz/notes/static/icons/fold-default.png'
                        : 'https://youupro.xyz/notes/static/icons/fold-selected.png'
                    "
                    mode="aspectFit"
                  />
                </button>
              </view>
            </view>

            <view v-if="isShareKbExpanded">
              <!--增加可选链保护 length 访问 -->
              <view
                v-if="shareKbList?.length === 0"
                class="empty-tip"
              >
                <text>暂无分享给我的知识库</text>
              </view>
              <!--遍历前确保数组存在 -->
              <view
                class="kb-item"
                v-for="item in shareKbList || []"
                :key="`share-${item.id}`"
                :class="{ active: tabState[activeTab].selectedKbId === item.id }"
              >
                <view
                  class="kb-info"
                  @click="selectKb(item.id)"
                >
                  <!-- 核心修改：将公开/私有标签与名称放在同一行，标签在前 -->
                  <view class="kb-name-row">
                    <text
                      class="kb-public"
                      v-if="item.is_public"
                    >
                      公开
                    </text>
                    <text
                      class="kb-private"
                      v-else
                    >
                      私有
                    </text>
                    <text class="kb-name">{{ item.name }}</text>
                  </view>
                  <text class="kb-desc">
                    <text
                      v-if="item.creator_username"
                      class="kb-author"
                    >
                      @{{ item.creator_username }}
                    </text>
                    <text v-if="item.creator_username && item.description"> · </text>{{ item.description || '' }}
                  </text>
                </view>
                <!-- 新增：关注/取消关注按钮 -->
                <view
                  class="kb-more"
                  @click.stop="openKbActions(item, 'shared')"
                >
<image
                    class="kb-more-icon"
                    src="/static/icons/three.png"
                    mode="aspectFit"
                  />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 右侧栏：我的知识库 -->
        <view
          class="kb-column right-column"
          v-if="activeTab === 'right'"
        >
          <view class="kb-section">
            <view class="kb-header">
              <text class="title">我的知识库</text>
              <view class="kb-header-actions">
                <!-- 知识库折叠按钮 -->
                <button
                  class="fold-button"
                  @click="toggleKbListExpand"
                >
                  <image
                    class="fold-icon"
                    :src="
                      isKbListExpanded
                        ? 'https://youupro.xyz/notes/static/icons/fold-default.png'
                        : 'https://youupro.xyz/notes/static/icons/fold-selected.png'
                    "
                    mode="aspectFit"
                  />
                </button>
                <!-- 知识库按钮 -->
                <view class="add-kb-section">
                  <button
                    @click="toAddKb"
                    class="add-button"
                  >
                    <image
                      class="add-icon"
                      src="https://youupro.xyz/notes/static/icons/add.png"
                      mode="aspectFit"
                    />
                  </button>
                </view>
              </view>
            </view>

            <!-- 知识库列表内容 显示/隐藏 -->
            <view v-if="isKbListExpanded">
              <!-- 空列表提示, 可选链保护 length 访问 -->
              <view
                v-if="kbList?.length === 0"
                class="empty-tip"
              >
                <text>暂无知识库，点击「新增知识库」创建</text>
              </view>

              <!--知识库条目, 遍历前确保数组存在 -->
              <view
                class="kb-item"
                v-for="item in kbList || []"
                :key="`my-${item.id}`"
                :class="{ active: tabState[activeTab].selectedKbId === item.id }"
              >
                <view
                  class="kb-info"
                  @click="selectKb(item.id)"
                >
                  <!-- 核心修改：将公开/私有标签与名称放在同一行，标签在前 -->
                  <view class="kb-name-row">
                    <text
                      class="kb-public"
                      v-if="item.is_public"
                    >
                      公开
                    </text>
                    <text
                      class="kb-private"
                      v-else
                    >
                      私有
                    </text>
                    <text class="kb-name">{{ item.name }}</text>
                  </view>
                  <text class="kb-desc">{{ item.description || '' }}</text>
                </view>
                <view
                  class="kb-more"
                  @click.stop="openKbActions(item, 'mine')"
                >
<image
                    class="kb-more-icon"
                    src="/static/icons/three.png"
                    mode="aspectFit"
                  />
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 文章列表：仅选中知识库且非加载中时显示 -->
    <view
      class="node-list"
      v-if="
        tabState[activeTab].selectedKbId &&
        (activeTab === 'right'
          ? kbList?.length > 0
          : followKbList?.length > 0 || shareKbList?.length > 0)
      "
    >
      <!-- 二级头部：明确的返回 + 当前知识库 + 篇数 + 主操作 -->
      <view class="node-topbar">
        <view
          class="node-topbar-back"
          @click="backToKbList"
        >
          <text class="node-topbar-arrow">‹</text>
          <text class="node-topbar-name">{{ selectedKbName }}</text>
        </view>
        <button
          class="node-topbar-add"
          @click="toAddNode"
        >
          + 新增文章
        </button>
      </view>
      <text class="node-topbar-count">
        共 {{ (tabState[activeTab].nodeList || []).length }} 篇
        <text v-if="tabState[activeTab].isNodeListExpanded">
          · <text @click="toggleNodeListExpand">收起</text>
        </text>
        <text v-else>
          · <text @click="toggleNodeListExpand">展开</text>
        </text>
      </text>

      <!-- 文章加载中：局部提示，替代原来的整页 loading -->
      <view
        v-if="isLoading"
        class="node-loading"
      >
        <uni-load-more
          type="loading"
          text="加载文章中..."
        />
      </view>

      <!-- 文章列表内容：根据折叠状态显示/隐藏 -->
      <view v-else-if="tabState[activeTab].isNodeListExpanded">

        <!--增加可选链保护 length 访问 -->
        <view
          v-if="tabState[activeTab].nodeList?.length === 0"
          class="empty-tip"
        >
          <text>当前知识库暂无文章，点击「新增文章」创建</text>
        </view>

        <!--遍历前确保数组存在 -->
        <view
          class="node-item"
          v-for="item in tabState[activeTab].nodeList || []"
          :key="item.id"
        >
          <view
            class="node-main"
            @click="toNodeDetail(item.id)"
          >
            <text class="node-name">{{ item.name }}</text>
            <!-- 体量与时间都来自真实数据：字数按正文粗算，时间取 updated_at -->
            <text class="node-meta">
              {{ nodeWordCount(item.content) }} 字<text v-if="nodeTimeText(item.updated_at)">
                · {{ nodeTimeText(item.updated_at) }}</text
              >
            </text>
          </view>
          <view
            class="kb-more"
            @click.stop="openNodeActions(item)"
          >
<image
                    class="kb-more-icon"
                    src="/static/icons/three.png"
                    mode="aspectFit"
                  />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import {
  getKnowledgeBaseList,
  getKnowledgeNodeList,
  deleteKnowledgeNode,
  deleteKnowledgeBase,
  addKnowledgeNode,
  getFollowKnowledgeBaseList,
  getSharedToMeKnowledgeBaseList,
  followKnowledgeBase,
  unfollowKnowledgeBase,
} from '@/api/knowledge'

// ==========  分栏相关状态 ==========
// 活跃分栏（left:关注/分享，right:我的），从缓存读取
const getActiveTab = (): string => {
  try {
    const cache = uni.getStorageSync('kbActiveTab')
    return cache || 'right' // 默认显示我的知识库
  } catch (e) {
    return 'right'
  }
}
const activeTab = ref<string>(getActiveTab())

// 关注的知识库列表及折叠状态（初始化空数组，TS 类型明确）
const followKbList = ref<any[]>([])
const getFollowKbExpandedStatus = (): boolean => {
  try {
    const cache = uni.getStorageSync('followKbExpandedStatus')
    return cache === '' || cache === null || cache === undefined ? true : Boolean(cache)
  } catch (e) {
    return true
  }
}
const isFollowKbExpanded = ref<boolean>(getFollowKbExpandedStatus())

// 分享给我的知识库列表及折叠状态（初始化空数组，TS 类型明确）
const shareKbList = ref<any[]>([])
const getShareKbExpandedStatus = (): boolean => {
  try {
    const cache = uni.getStorageSync('shareKbExpandedStatus')
    return cache === '' || cache === null || cache === undefined ? true : Boolean(cache)
  } catch (e) {
    return true
  }
}
const isShareKbExpanded = ref<boolean>(getShareKbExpandedStatus())

// ========== 原有状态重构：按标签页存储状态 ==========
// 定义标签页状态结构
interface TabState {
  selectedKbId: string
  nodeList: any[]
  isNodeListExpanded: boolean
}

// 从缓存读取指定标签页的节点列表折叠状态
const getNodeListExpandedStatus = (tab: string): boolean => {
  try {
    const cache = uni.getStorageSync(`nodeListExpandedStatus_${tab}`)
    return cache === '' || cache === null || cache === undefined ? true : Boolean(cache)
  } catch (e) {
    return true
  }
}

// 从缓存读取指定标签页的选中知识库ID
const getSelectedKbId = (tab: string): string => {
  try {
    const cache = uni.getStorageSync(`selectedKbId_${tab}`)
    return cache || ''
  } catch (e) {
    return ''
  }
}

// 初始化标签页状态（带记忆功能）
const tabState = ref<Record<string, TabState>>({
  left: {
    selectedKbId: getSelectedKbId('left'),
    nodeList: [],
    isNodeListExpanded: getNodeListExpandedStatus('left'),
  },
  right: {
    selectedKbId: getSelectedKbId('right'),
    nodeList: [],
    isNodeListExpanded: getNodeListExpandedStatus('right'),
  },
})

const kbList = ref<any[]>([]) // 我的知识库列表（初始化空数组）
const isLoading = ref(false) // 列表/文章级加载状态（局部 loading）
const firstLoading = ref(true) // 仅首次进入时的整页加载状态

/** 使用引导是否折叠：首次进入默认展开，用户收起后记住选择 */
const GUIDE_COLLAPSED_KEY = 'kbGuideCollapsed'
const guideCollapsed = ref(uni.getStorageSync(GUIDE_COLLAPSED_KEY) === true)

const toggleGuide = () => {
  guideCollapsed.value = !guideCollapsed.value
  uni.setStorageSync(GUIDE_COLLAPSED_KEY, guideCollapsed.value)
}
let refreshTimer: number | null = null // 防抖定时器

//先定义获取缓存状态的函数，再赋值给ref（正确的TS写法）
const getKbListExpandedStatus = (): boolean => {
  try {
    const cache = uni.getStorageSync('kbListExpandedStatus')
    // uni.getStorageSync 返回空字符串/undefined 时，默认展开
    return cache === '' || cache === null || cache === undefined ? true : Boolean(cache)
  } catch (e) {
    return true
  }
}

// 折叠状态管理（从本地缓存读取，无则默认展开）- 修复后
const isKbListExpanded = ref<boolean>(getKbListExpandedStatus())

/**
 * 核心修复：计算属性重命名为 selectedKbName，避免命名混淆 + 空值保护
 * 基于当前激活标签页的选中ID获取名称
 */
const selectedKbName = computed(() => {
  const currentTab = activeTab.value
  const currentSelectedId = tabState.value[currentTab].selectedKbId

  if (!currentSelectedId) return ''

  // 根据当前标签页筛选对应的知识库列表
  let targetList: any[] = []
  if (currentTab === 'right') {
    targetList = kbList.value || []
  } else {
    targetList = [...(followKbList.value || []), ...(shareKbList.value || [])]
  }

  const targetKb = targetList.find((item) => item.id === currentSelectedId)
  return targetKb ? targetKb.name : '未知知识库'
})

// ==========  新增：关注相关方法 ==========
/**
 * 判断知识库是否已关注
 * @param kbId 知识库ID
 */
const isKbFollowed = (kbId: string): boolean => {
  const safeFollowKbList = followKbList.value || []
  return safeFollowKbList.some((item) => item.id === kbId)
}

/**
 * 关注知识库处理函数
 * @param kbId 知识库ID
 */
const followKbHandle = async (kbId: string) => {
  uni.showModal({
    title: '确认关注',
    content: '是否确认关注该知识库？',
    async success(res) {
      if (res.confirm) {
        isLoading.value = true
        try {
          await followKnowledgeBase(kbId)
          uni.showToast({ title: '关注成功', icon: 'success' })
          // 刷新关注列表
          await refreshKnowledgeBaseList(true)
        } catch (error) {
          console.error('关注知识库失败：', error)
          const errMsg = (error as Error).message.includes('403')
            ? '无关注权限'
            : '关注失败，请重试'
          uni.showToast({ title: errMsg, icon: 'none' })
        } finally {
          isLoading.value = false
        }
      }
    },
  })
}

/**
 * 取消关注知识库处理函数
 * @param kbId 知识库ID
 */
const unfollowKbHandle = async (kbId: string) => {
  uni.showModal({
    title: '确认取消关注',
    content: '是否确认取消关注该知识库？',
    async success(res) {
      if (res.confirm) {
        isLoading.value = true
        try {
          await unfollowKnowledgeBase(kbId)
          uni.showToast({ title: '取消关注成功', icon: 'success' })
          // 刷新关注列表
          await refreshKnowledgeBaseList(true)
        } catch (error) {
          console.error('取消关注知识库失败：', error)
          const errMsg = (error as Error).message.includes('403')
            ? '无取消关注权限'
            : '取消关注失败，请重试'
          uni.showToast({ title: errMsg, icon: 'none' })
        } finally {
          isLoading.value = false
        }
      }
    },
  })
}

// ==========  分栏相关方法 ==========
/**
 * 切换分栏并缓存状态
 */
const switchTab = (tab: string) => {
  activeTab.value = tab
  uni.setStorageSync('kbActiveTab', tab)
}

/**
 * 切换关注的知识库折叠状态
 */
const toggleFollowKbExpand = () => {
  isFollowKbExpanded.value = !isFollowKbExpanded.value
  uni.setStorageSync('followKbExpandedStatus', isFollowKbExpanded.value)
}

/**
 * 切换分享给我的知识库折叠状态
 */
const toggleShareKbExpand = () => {
  isShareKbExpanded.value = !isShareKbExpanded.value
  uni.setStorageSync('shareKbExpandedStatus', isShareKbExpanded.value)
}

// ========== 原有方法 ==========
/**
 * 切换知识库列表折叠/展开状态（带本地记忆）
 */
const toggleKbListExpand = () => {
  isKbListExpanded.value = !isKbListExpanded.value
  // 保存到本地缓存（确保存储的是boolean类型）
  uni.setStorageSync('kbListExpandedStatus', isKbListExpanded.value)
}

/**
 * 切换当前标签页的文章列表折叠/展开状态（带本地记忆）
 */
const toggleNodeListExpand = () => {
  const currentTab = activeTab.value
  tabState.value[currentTab].isNodeListExpanded = !tabState.value[currentTab].isNodeListExpanded
  // 按标签页保存到本地缓存
  uni.setStorageSync(
    `nodeListExpandedStatus_${currentTab}`,
    tabState.value[currentTab].isNodeListExpanded,
  )
}

/**
 * 刷新所有知识库列表（我的、关注的、分享的）
 */
const refreshKnowledgeBaseList = async (isForce = false) => {
  if (!isForce && refreshTimer) return
  if (!isForce) {
    refreshTimer = setTimeout(() => {
      doRefreshKbList()
      refreshTimer = null
    }, 500) as unknown as number
  } else {
    doRefreshKbList()
  }
}

/**
 * 实际刷新知识库列表逻辑（核心修复：接口返回值空值保护 + 标签页状态校验）
 */
const doRefreshKbList = async () => {
  isLoading.value = true
  try {
    // 1. 获取我的知识库（原有接口）-空值兜底
    const myKbRes = await getKnowledgeBaseList()
    kbList.value = myKbRes?.results || [] // 防止 res 为 undefined 或无 results 属性

    // 2. 获取关注的知识库（替换为真实接口调用）-空值兜底
    const followKbRes = await getFollowKnowledgeBaseList()
    followKbList.value = followKbRes?.results || []

    // 3. 获取分享给我的知识库（替换为真实接口调用）-空值兜底
    const shareKbRes = await getSharedToMeKnowledgeBaseList()
    shareKbList.value = shareKbRes?.results || []

    // 校验各标签页选中的知识库是否存在，不存在则清空
    // 校验right标签页（我的知识库）
    const rightKbIds = (kbList.value || []).map((item) => item.id)
    if (
      tabState.value.right.selectedKbId &&
      !rightKbIds.includes(tabState.value.right.selectedKbId)
    ) {
      tabState.value.right.selectedKbId = ''
      tabState.value.right.nodeList = []
      uni.setStorageSync('selectedKbId_right', '')
    }

    // 校验left标签页（关注/分享）
    const leftKbIds = [...(followKbList.value || []), ...(shareKbList.value || [])].map(
      (item) => item.id,
    )
    if (tabState.value.left.selectedKbId && !leftKbIds.includes(tabState.value.left.selectedKbId)) {
      tabState.value.left.selectedKbId = ''
      tabState.value.left.nodeList = []
      uni.setStorageSync('selectedKbId_left', '')
    }
  } catch (error) {
    console.error('刷新知识库列表失败：', error)
    //出错时强制赋值空数组，避免后续渲染报错
    kbList.value = []
    followKbList.value = []
    shareKbList.value = []
    uni.showToast({ title: '刷新失败，请重试', icon: 'none' })
  } finally {
    isLoading.value = false
    firstLoading.value = false // 首次加载结束，之后一律走局部 loading
  }
}

/**
 * 选择当前标签页的知识库 - 仅加载该库下的文章
 */
const selectKb = async (id: string, isRefresh = true, force = false) => {
  const currentTab = activeTab.value
  // force=true 用于「删除文章后刷新」等场景：此时 id 与当前选中项相同，
  // 如果不放行就会直接 return，导致列表不更新
  if (!force && id === tabState.value[currentTab].selectedKbId) return

  if (isRefresh) isLoading.value = true
  // 更新当前标签页的选中状态
  tabState.value[currentTab].selectedKbId = id
  tabState.value[currentTab].nodeList = [] // 先清空旧文章
  // 缓存当前标签页的选中ID
  uni.setStorageSync(`selectedKbId_${currentTab}`, id)

  try {
    const res = await getKnowledgeNodeList(id)
    //接口返回值空值兜底
    tabState.value[currentTab].nodeList = res?.results || []

    // 检查是否存在待加入的文档（来自搜索页面的 pendingDocToAdd）
    try {
      const pendingRaw = uni.getStorageSync('pendingDocToAdd')
      let pending: any = null
      if (pendingRaw) {
        pending = typeof pendingRaw === 'string' ? JSON.parse(pendingRaw) : pendingRaw
      }
      if (pending && pending.doc) {
        // 弹框确认是否将该文档加入当前选择的知识库
        uni.showModal({
          title: '加入知识库',
          content: `将文档 "${pending.doc.name || pending.doc.title || '未命名'}" 加入知识库 "${selectedKbName.value}" ?`,
          confirmText: '加入',
          cancelText: '取消',
          async success(res) {
            if (res.confirm) {
              try {
                await addKnowledgeNode({
                  name: pending.doc.name || pending.doc.title || '未命名',
                  content: pending.doc.content || pending.doc.summary || '',
                  knowledge_base_id: id,
                })
                uni.showToast({ title: '已加入知识库', icon: 'success' })
                // 清除 pending
                uni.removeStorageSync('pendingDocToAdd')
                // 刷新当前标签页的文章列表（force=true 绕过同 ID 早退）
                await selectKb(id, true, true)
              } catch (err) {
                console.error('将文档加入知识库失败：', err)
                uni.showToast({ title: '加入失败', icon: 'none' })
              }
            }
          },
        })
      }
    } catch (e) {
      console.warn('解析 pendingDocToAdd 失败：', e)
    }
  } catch (error) {
    // 仅打印警告，不抛出错误，友好提示用户
    console.warn('加载知识库内容时出现异常：', error)
    uni.showToast({ title: '您没有访问该知识库的权限', icon: 'none' })
    tabState.value[currentTab].nodeList = []
  } finally {
    if (isRefresh) isLoading.value = false
  }
}

// ====================== 生命周期 ======================
onLoad(async (options?: { tab?: string; kbId?: string }) => {
  // 支持分享卡片深链：?tab=left|right&kbId=xxx
  if (options?.tab === 'left' || options?.tab === 'right') {
    activeTab.value = options.tab
    uni.setStorageSync('kbActiveTab', options.tab)
  }
  await refreshKnowledgeBaseList(true)

  // 分享链接指定了知识库，优先选中它
  if (options?.kbId) {
    await selectKb(options.kbId, false, true)
    return
  }

  // 初始化时加载当前标签页选中知识库的文章
  const currentTab = activeTab.value
  const currentSelectedId = tabState.value[currentTab].selectedKbId
  if (currentSelectedId) {
    await selectKb(currentSelectedId, false)
  }
})

onShow(() => {
  refreshKnowledgeBaseList();

  // 从「新增文章 / 编辑文章」返回时，文章列表也必须刷新。
  // 否则会停在旧数据上：新加的文章不出现，篇数还是 0（新建的知识库本来就没有文章）。
  // force = true 是因为此时 id 与当前选中项相同，不放行会被 selectKb 直接 return。
  const currentTab = activeTab.value;
  const selectedId = tabState.value[currentTab].selectedKbId;
  if (selectedId) {
    selectKb(selectedId, false, true);
  }
})

// ====================== 新增：分享功能 ======================
// 分享给好友
onShareAppMessage(() => {
  const currentTab = activeTab.value
  const currentKbId = tabState.value[currentTab].selectedKbId
  const shareTitle = currentKbId ? `知识库-${selectedKbName.value}` : '我的知识库管理'
  // 知识库首页注册在主包，旧路径 /pagesMember/knowledge/knowledge 并不存在
  const sharePath = `/pages/knowledge/knowledge?tab=${currentTab}&kbId=${currentKbId || ''}`

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl: 'https://youupro.xyz/notes/static/icons/share-icon.png', // 可替换为实际分享图片地址
  }
})

// 分享到朋友圈
onShareTimeline(() => {
  const currentTab = activeTab.value
  const currentKbId = tabState.value[currentTab].selectedKbId
  const shareTitle = currentKbId ? `知识库-${selectedKbName.value}` : '我的知识库管理'

  return {
    title: shareTitle,
    query: `tab=${currentTab}&kbId=${currentKbId || ''}`,
    imageUrl: 'https://youupro.xyz/notes/static/icons/share-icon.png', // 可替换为实际分享图片地址
  }
})

// ====================== 页面操作方法 ======================
const toAddKb = () => {
  uni.navigateTo({
    url: '/pagesMember/knowledge/addKb/addKb',
  })
}

const toAddNode = () => {
  const currentTab = activeTab.value
  if (!tabState.value[currentTab].selectedKbId) {
    uni.showToast({ title: '请先选择一个知识库', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: `/pagesMember/knowledge/addNode/addNode?kbId=${tabState.value[currentTab].selectedKbId}`,
  })
}

const toNodeDetail = (id: string) => {
  uni.navigateTo({
    url: `/pagesMember/knowledge/showNode/showNode?id=${id}&type=detail`,
  })
}

const toEditNode = (id: string) => {
  uni.navigateTo({
    url: `/pagesMember/knowledge/editNode/editNode?id=${id}&type=edit`,
  })
}

const deleteNode = async (id: string) => {
  uni.showModal({
    title: '确认删除',
    content: '是否删除该文章？',
    async success(res) {
      if (res.confirm) {
        isLoading.value = true
        try {
          await deleteKnowledgeNode(id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          const currentTab = activeTab.value
          // force=true：被删的正是当前知识库，必须绕过 selectKb 的同 ID 早退
          await selectKb(tabState.value[currentTab].selectedKbId, true, true)
        } catch (error) {
          console.error('删除文章失败：', error)
          uni.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          isLoading.value = false
        }
      }
    },
  })
}

const deleteKnowledgeBaseHandle = async (kbId: string) => {
  uni.showModal({
    title: '危险操作',
    content: '删除知识库将同时删除其下所有文章，是否确认删除？',
    confirmText: '确认删除',
    cancelText: '取消',
    confirmColor: '#ff4d4f',
    async success(res) {
      if (res.confirm) {
        isLoading.value = true
        try {
          await deleteKnowledgeBase(kbId)
          uni.showToast({ title: '删除成功', icon: 'success' })

          // 清空right标签页中该知识库的选中状态
          if (tabState.value.right.selectedKbId === kbId) {
            tabState.value.right.selectedKbId = ''
            tabState.value.right.nodeList = []
            uni.setStorageSync('selectedKbId_right', '')
          }

          await refreshKnowledgeBaseList(true)
        } catch (error) {
          console.error('删除知识库失败：', error)
          const errMsg = (error as Error).message.includes('403')
            ? '无删除权限'
            : '删除失败，请重试'
          uni.showToast({ title: errMsg, icon: 'none' })
        } finally {
          isLoading.value = false
        }
      }
    },
  })
}

// 下拉刷新：重新拉取三个知识库列表，并刷新当前选中知识库的文章
onPullDownRefresh(async () => {
  try {
    await refreshKnowledgeBaseList(true)
    const currentTab = activeTab.value
    const selectedId = tabState.value[currentTab].selectedKbId
    if (selectedId) {
      // force=true：选中的就是它，必须绕过同 ID 早退
      await selectKb(selectedId, false, true)
    }
  } finally {
    uni.stopPullDownRefresh()
  }
})

// ====================== 页面改造新增 ======================

/** 顶部概览：数量取自实际列表，不编造 */
const kbTotal = computed(() =>
  activeTab.value === 'right'
    ? kbList.value?.length ?? 0
    : (followKbList.value?.length ?? 0) + (shareKbList.value?.length ?? 0)
)

/** 文章体量：按正文字符数粗算（去掉空白），只作体量感参考 */
const nodeWordCount = (content?: string) => (content ? content.replace(/\s/g, '').length : 0)

/** 更新时间文案：今天 / N 天前 / 具体日期 */
const nodeTimeText = (updatedAt?: string) => {
  if (!updatedAt) return ''
  const t = new Date(String(updatedAt).replace(/-/g, '/')).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return '今天更新'
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前更新`
  const d = new Date(t)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日更新`
}

/**
 * 知识库行的「更多」操作。
 *
 * 取消关注、删除这类破坏性操作原来和整行的点击区挤在一起，很容易误触，
 * 现在统一收进系统操作菜单。
 */
const openKbActions = (item: any, kind: 'followed' | 'shared' | 'mine') => {
  const list =
    kind === 'mine'
      ? ['删除知识库']
      : kind === 'shared'
        ? ['关注', '取消关注']
        : ['取消关注']
  uni.showActionSheet({
    itemList: list,
    success: (res) => {
      const picked = list[res.tapIndex]
      if (picked === '关注') followKbHandle(String(item.id))
      else if (picked === '取消关注') unfollowKbHandle(String(item.id))
      else if (picked === '删除知识库') deleteKnowledgeBaseHandle(String(item.id))
    },
    fail: () => {},
  })
}

/** 文章行的「更多」操作：编辑 / 删除 */
const openNodeActions = (item: any) => {
  uni.showActionSheet({
    itemList: ['编辑', '删除'],
    success: (res) => {
      if (res.tapIndex === 0) toEditNode(String(item.id))
      else if (res.tapIndex === 1) deleteNode(String(item.id))
    },
    fail: () => {},
  })
}

/** 从文章列表返回知识库列表 */
const backToKbList = () => {
  tabState[activeTab.value].selectedKbId = ''
}
</script>

<style scoped lang="scss">
// 设计令牌：与全站橙色主色体系保持一致
// （这一页原来是独立的「浅蓝主题」：极浅蓝底 + 蓝色调阴影，和全站的橙色主色互相打架，
//   是页面看起来不协调的主因。旧变量名保留，避免大范围改选择器。）
$brand: #FF7239; // 主色
$brand-soft: #fff7f2; // 主色浅底
$brand-line: #ffd0bb; // 主色描边
$page-bg: #f7f8fa; // 页面底色：白卡浮在浅灰上才有层次
$line: #f1f5f9; // 分隔线

$primary-color: #ffffff; // 按钮主题色改为白色
$secondary-color: #ff4500; // 线条主题色改为橙红色
$accent-color: $brand; // 原来是浅蓝 #93c5fd，统一到主色
$success-color: #31e8ab; // 绿色保持
$danger-color: #ef4444; // 红色保持
$text-primary: #1f2937; // 深黑
$text-secondary: #6b7280; // 中灰
$text-tertiary: #9ca3af; // 浅灰
$white: #ffffff; // 白
$gray-light: #f7f8fa; // 原为极浅蓝，改中性浅灰
$gray-lighter: #eef0f3; // 原为浅蓝，改中性浅灰
$shadow-light: 0 2rpx 10rpx rgba(31, 41, 55, 0.04); // 原为蓝色调阴影
$shadow-medium: 0 4rpx 20rpx rgba(31, 41, 55, 0.06);
$shadow-strong: 0 8rpx 28rpx rgba(31, 41, 55, 0.08);
$border-radius-large: 20rpx;
$border-radius-medium: 16rpx;
$border-radius-small: 12rpx;

.knowledge-page {
  min-height: 100vh;
  background: $page-bg;
  padding: 24rpx;
}

.loading-container {
  padding: 80rpx 0;
  text-align: center;
  background: $white;
  border-radius: $border-radius-large;
  margin: 24rpx;
  box-shadow: $shadow-medium;
}

// ==========  分栏样式 ==========
.kb-container {
  width: 100%;
}

.kb-tab-header {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.tab-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-secondary;
  background: $gray-lighter;
  border-radius: $border-radius-medium;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  &::after {
    border: none !important;
  }

  &.active {
    color: $white;
    background: linear-gradient(135deg, #FF8A54 0%, #FF7239 100%);
  }
}

.kb-columns {
  width: 100%;
}

.kb-column {
  width: 100%;
}

.kb-section {
  background: $white;
  border: 1rpx solid $line;
  border-radius: $border-radius-large;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-medium;
}

// ========== 原有样式 ==========
.node-list {
  background: $white;
  border: 1rpx solid $line;
  border-radius: $border-radius-large;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-medium;
}

/* Enhanced Header Design */
.kb-header,
.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1rpx;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(0, 122, 255, 0.1) 50%,
      transparent 100%
    );
  }
}

//  知识库头部操作区样式
.kb-header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.node-subheader {
  padding-bottom: 12rpx;
  margin-bottom: 16rpx;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.02) 0%, rgba(88, 86, 214, 0.02) 100%);
  padding: 12rpx 16rpx;
  border-radius: $border-radius-medium;
  // flex布局，让文字左对齐，按钮右对齐
  display: flex;
  justify-content: space-between;
  align-items: center;
  //确保容器宽度100%
  width: 100%;
  box-sizing: border-box;
}

.subheader-text {
  font-size: 26rpx;
  color: $text-secondary;
  font-weight: 500;
  // 文字左对齐，占据剩余空间
  flex: 1;
  text-align: left;
}

// 折叠按钮样式（通用）
.fold-button {
  width: 40rpx;
  height: 40rpx;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none !important;
  border-radius: 0 !important;
  outline: none !important;
  box-shadow: none !important;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:active {
    transform: scale(0.9);
    border: none !important;
    box-shadow: none !important;
  }

  &::after {
    border: none !important;
  }
}

// 文章列表折叠按钮专属样式 - 强制靠右
.node-fold-button {
  flex: none !important;
  margin-left: auto !important;
}

// 折叠图标样式（通用）
.fold-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border: none;
  display: block;
}

.title {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -0.5rpx;
}

/* Add Button Sections */
.add-kb-section {
  position: static !important; // 取消绝对定位，改为静态布局
  transform: none !important; // 取消位移
}

.add-node-section {
  position: absolute;
  right: 3%; // 靠右3%
  top: 50%; // 垂直居中
  transform: translateY(-50%); // 精准垂直居中（抵消自身高度）
}

.add-button {
  width: 40rpx;
  height: 40rpx;
  background: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  // 彻底移除所有边框相关样式
  border: none !important; // 移除默认边框（加!important确保覆盖小程序默认样式）
  border-radius: 0 !important; // 可选：移除默认圆角（如需圆形按钮可设50%）
  outline: none !important; // 移除聚焦态外边框
  box-shadow: none !important; // 移除默认阴影
  // 移除小程序button的默认样式污染
  appearance: none;
  -webkit-appearance: none;
  // 移除点击高亮
  -webkit-tap-highlight-color: transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:active {
    transform: scale(0.9);
    // 确保点击态也无边框
    border: none !important;
    box-shadow: none !important;
  }

  // 兼容不同端的button默认样式
  &::after {
    border: none !important; // 移除小程序button伪元素生成的边框
  }
}

.add-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border: none;
  display: block; // 防止基线对齐偏移
}

/* Action Icons */
.action-icon {
  width: 30rpx;
  height: 30rpx;
  border: none; // 去掉默认边框
}

/* Enhanced Knowledge Base Items */
.kb-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  border-radius: $border-radius-medium;
  margin-bottom: 14rpx;
  background: $white;
  border: 1rpx solid $line;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;

  // 左侧主色指示条（原来是从白色渐变到橙红，等于一条白杠）
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0;
    background: $brand;
    transition: width 0.2s ease;
  }

  // 按下反馈改为浅橙底：原来同时改位移和阴影，点起来会抖
  &:active {
    background: $brand-soft;
    border-color: $brand-line;
  }

  &.active {
    background: $brand-soft;
    border-color: $brand-line;
    box-shadow: none;

    &::before {
      width: 6rpx;
    }
  }
}

.kb-info {
  flex: 1;
  cursor: pointer;
}

// 核心新增：名称行容器，实现标签和名称同行显示
.kb-name-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 6rpx;
  flex-wrap: nowrap;
  overflow: hidden;
}

.kb-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: -0.2rpx;
  flex: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

// 作者：用主色，视觉上提示"这是谁的知识库"
.kb-author {
  color: $brand;
  font-weight: 500;
}

.kb-desc {
  font-size: 24rpx;
  color: $text-secondary;
  font-weight: 400;
  display: block;
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-public {
  font-size: 20rpx;
  color: $success-color;
  background: linear-gradient(135deg, rgba(85, 85, 85, 0.1) 0%, rgba(85, 85, 85, 0.05) 100%);
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kb-private {
  font-size: 20rpx;
  color: $accent-color;
  background: linear-gradient(135deg, rgba(153, 153, 153, 0.1) 0%, rgba(153, 153, 153, 0.05) 100%);
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kb-actions {
  margin-left: 16rpx;
}

// 新增：关注/取消关注按钮样式
.follow-kb-btn,
.unfollow-kb-btn {
  color: $secondary-color;
  font-size: 24rpx;
  padding: 6rpx 10rpx;
  border-radius: 20rpx;
  font-weight: 600;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: #FF7239;
    color: $white;
    transform: scale(0.95);
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  &::after {
    border: none !important;
  }
}

.delete-kb-btn {
  color: $secondary-color;
  font-size: 24rpx;
  padding: 6rpx 10rpx;
  border-radius: 20rpx;
  font-weight: 600;
  // 彻底移除所有边框相关样式（加!important确保覆盖默认样式）
  border: none !important;
  outline: none !important; // 移除聚焦态外边框
  box-shadow: none !important; // 移除默认阴影/高光
  // 移除浏览器/小程序的默认按钮样式渲染
  appearance: none;
  -webkit-appearance: none;
  // 移除移动端点击高亮背景（非边框，但优化体验）
  -webkit-tap-highlight-color: transparent;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: $danger-color;
    color: $white;
    transform: scale(0.95);
    // 确保点击态也无任何边框/阴影
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  //移除小程序button伪元素生成的默认边框（90%的边框问题来自这里）
  &::after {
    border: none !important;
  }
}

/* Enhanced Node Items */
.node-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  border-radius: $border-radius-small;
  transition: background-color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;

  &:active {
    background: $brand-soft;
  }
}

.node-name {
  font-size: 26rpx;
  color: $text-primary;
  flex: 1;
  font-weight: 500;
  cursor: pointer;
  transition: none;
}

.node-actions {
  display: flex;
  gap: 12rpx;
}

.edit-btn {
  background: white;
  color: $primary-color;
  font-size: 24rpx;
  padding: 6rpx 10rpx;
  border-radius: 20rpx;
  font-weight: 600;
  // 彻底移除所有边框相关样式（加!important确保覆盖默认样式）
  border: none !important;
  outline: none !important; // 移除聚焦态虚线外边框
  box-shadow: none !important; // 移除默认阴影/高光
  // 移除浏览器/小程序的默认按钮样式渲染
  appearance: none;
  -webkit-appearance: none;
  // 移除移动端点击高亮背景（优化体验，无视觉干扰）
  -webkit-tap-highlight-color: transparent;
  // 原有样式保留
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: $primary-color;
    color: $white;
    transform: scale(0.95);
    // 确保点击态也无任何边框/阴影
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  //移除小程序button伪元素生成的默认边框（这是边框残留的核心原因）
  &::after {
    border: none !important;
  }
}

.delete-btn {
  background: white;
  color: $secondary-color;
  font-size: 30rpx;
  padding: 6rpx 10rpx;
  border-radius: 20rpx;
  font-weight: 600;
  // 移除所有边框相关样式（加!important确保覆盖默认样式）
  border: none !important;
  outline: none !important; // 移除聚焦态外边框
  box-shadow: none !important; // 移除默认阴影
  // 移除浏览器/小程序的默认按钮样式
  appearance: none;
  -webkit-appearance: none;
  // 移除点击高亮背景
  -webkit-tap-highlight-color: transparent;
  // 原有样式保留
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: $danger-color;
    color: $white;
    transform: scale(0.95);
    // 确保点击态也无任何边框
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  //移除小程序button伪元素生成的默认边框（很多时候边框是这里来的）
  &::after {
    border: none !important;
  }
}

/* 使用引导卡片 */
.guide-card {
  background: $brand-soft;
  border: 1rpx solid $brand-line;
  border-radius: $border-radius-large;
  padding: 22rpx;
  margin-bottom: 20rpx;
}

.guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guide-head-left {
  display: flex;
  align-items: center;
}

.guide-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 10rpx;
  flex-shrink: 0;
}

.guide-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $secondary-color;
}

.guide-toggle {
  font-size: 24rpx;
  color: $text-secondary;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.8);
}

.guide-body {
  margin-top: 16rpx;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.guide-num {
  flex: none;
  width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 50%;
  background: $secondary-color;
  color: #ffffff;
  font-size: 22rpx;
  margin-right: 12rpx;
}

.guide-text {
  flex: 1;
  font-size: 26rpx;
  line-height: 1.6;
  color: $text-secondary;
}

.guide-tip {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  border-radius: $border-radius-small;
  background: rgba(255, 255, 255, 0.75);
  font-size: 24rpx;
  line-height: 1.6;
  color: $text-tertiary;
}
/* 文章列表局部加载提示 */
.node-loading {
  padding: 32rpx 0;
  text-align: center;
}

/* ========== 图标按钮兜底可见性 ==========
   知识库的图标全部指向远程地址，一旦域名不可达或某张图 404，
   纯图标按钮就会变成「看不见但仍可点击」的空白热区。
   这里给它们加一层极浅的橙色底，保证图标挂掉时按钮位置依然可见。 */
.fold-button,
.add-button,
.follow-kb-btn,
.unfollow-kb-btn,
.delete-kb-btn,
.edit-btn,
.delete-btn {
  background: rgba(255, 69, 0, 0.06) !important;
  border-radius: 10rpx !important;
}

.fold-button,
.add-button {
  border-radius: 50% !important;
}

/* Responsive Design */
@media (max-width: 750rpx) {
  .knowledge-page {
    padding: 12rpx;
  }

  .node-list {
    padding: 16rpx;
    margin-bottom: 12rpx;
  }

  .kb-header,
  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12rpx;
  }

  .kb-header-actions {
    align-self: flex-end;
  }

  .kb-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12rpx;
  }

  .kb-actions {
    margin-left: 0;
    align-self: flex-end;
  }

  .node-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12rpx;
  }

  .node-actions {
    align-self: flex-end;
  }

  .title {
    font-size: 28rpx;
  }

  .kb-name {
    font-size: 24rpx;
  }

  .node-name {
    font-size: 22rpx;
  }

  // 响应式调整名称行
  .kb-name-row {
    width: 100%;
  }
}
/* ====================== 页面改造新增 ====================== */

/* 顶部概览：给页面一个锚点 */
.kb-overview {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  padding: 4rpx 8rpx 20rpx;
}

.kb-overview-num {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -0.5rpx;
}

.kb-overview-sub {
  font-size: 22rpx;
  color: $text-tertiary;
}

/* 分段控件：与能力画像页同一套视觉 */
.kb-tab-header {
  display: flex;
  gap: 8rpx;
  padding: 6rpx;
  margin-bottom: 20rpx;
  background: $gray-lighter;
  border-radius: 18rpx;
}

.tab-btn {
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  font-size: 27rpx;
  font-weight: 600;
  color: $text-secondary;
  background: transparent;
  border-radius: 14rpx;
  border: none !important;
  box-shadow: none !important;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;

  &::after {
    border: none !important;
  }

  &.active {
    color: $white;
    background: linear-gradient(135deg, #FF8A54 0%, #FF7239 100%);
    box-shadow: $shadow-light;
  }
}

/* 知识库行：左侧主色细条常显 = 「可以点进去」的视觉暗示 */
.kb-item::before {
  width: 6rpx !important;
  background: $brand-line !important;
}

.kb-item.active::before {
  background: $brand !important;
}

/* 「更多」按钮：破坏性操作入口，与整行点击区分离 */
.kb-more {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  margin-left: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: $gray-lighter;
  }
}

.kb-more-icon {
  width: 34rpx;
  height: 34rpx;
  opacity: 0.65;
}



/* 文章二级头部 */
.node-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 6rpx;
}

.node-topbar-back {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.node-topbar-arrow {
  font-size: 34rpx;
  color: $text-secondary;
  margin-right: 6rpx;
  line-height: 1;
}

.node-topbar-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $text-primary;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.node-topbar-add {
  flex-shrink: 0;
  height: 60rpx;
  line-height: 60rpx;
  padding: 0 24rpx;
  margin: 0;
  font-size: 24rpx;
  font-weight: 600;
  color: $white;
  background: linear-gradient(135deg, #FF8A54 0%, #FF7239 100%);
  border-radius: 30rpx;
  border: none !important;
  box-shadow: none !important;

  &::after {
    border: none !important;
  }
}

.node-topbar-count {
  display: block;
  font-size: 22rpx;
  color: $text-tertiary;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

/* 文章行：名称 + 体量/时间两行 */
.node-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.node-meta {
  font-size: 22rpx;
  color: $text-tertiary;
  margin-top: 6rpx;
}

/* 引导卡收紧 */
.guide-card {
  padding: 20rpx 22rpx;
}

.guide-title {
  font-size: 26rpx;
}
</style>
