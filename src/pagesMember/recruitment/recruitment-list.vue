<template>
  <view class="recruitment-list-page">
    <!-- 顶部搜索 + 筛选 -->
    <view class="list-header">
      <view class="search-box">
        <uni-icons type="search" size="18" color="#9aa0a8" />
        <input
          v-model="searchKeyword"
          class="search-input"
          type="text"
          placeholder="搜索岗位、企业或专业"
          confirm-type="search"
          @confirm="handleSearch"
        />
        <text
          v-if="searchKeyword"
          class="search-clear"
          @click="clearSearch"
        >
          ×
        </text>
      </view>
      <view class="filter-toggle" @click="toggleCollapse('filter')">
        <uni-icons type="tune" size="20" color="#17191c" />
        <text class="filter-toggle-text">筛选</text>
        <text v-if="activeFilterCount" class="filter-badge">{{ activeFilterCount }}</text>
      </view>
    </view>

    <!-- 快捷分类 -->
    <scroll-view
      scroll-x
      class="quick-scroll"
      :show-scrollbar="false"
    >
      <view class="quick-chips">
        <text
          v-for="chip in quickChips"
          :key="chip.key"
          class="quick-chip"
          :class="{ active: quickFilter === chip.key }"
          @click="setQuickFilter(chip.key)"
        >
          {{ chip.label }}
        </text>
      </view>
    </scroll-view>

    <!-- 数量 + 排序 -->
    <view class="list-toolbar">
      <text class="result-count">{{ filteredList.length }} 个岗位</text>
      <picker
        :range="sortOptions"
        :value="selectedSortIndex"
        @change="handleSortChange"
      >
        <view class="sort-picker">
          <text class="sort-text">{{ sortOptions[selectedSortIndex] }}</text>
          <uni-icons type="down" size="12" color="#9aa0a8" />
        </view>
      </picker>
    </view>

    <!-- 筛选面板 -->
    <view
      v-if="collapseStates.filter"
      class="filter-panel"
    >
      <view class="filter-panel-head">
        <text class="filter-panel-title">筛选条件</text>
        <text class="filter-reset" @click="resetFilter">重置</text>
      </view>

      <view
        v-for="(options, field) in filterOptions"
        :key="field"
        class="filter-group"
      >
        <view
          class="filter-group-head"
          @click="toggleDimensionCollapse(field)"
        >
          <text class="filter-group-name">{{ fieldLabels[field] }}</text>
          <text
            v-if="activeFilters[field]"
            class="filter-group-value"
          >
            {{ activeFilters[field] }}
          </text>
          <uni-icons
            :type="dimensionCollapseStates[field] ? 'up' : 'down'"
            size="12"
            color="#9aa0a8"
          />
        </view>

        <view
          v-if="dimensionCollapseStates[field]"
          class="filter-chips"
        >
          <text
            v-for="option in options"
            :key="option"
            class="filter-chip"
            :class="{ active: activeFilters[field] === option }"
            @click.stop="toggleFilter(field, option)"
          >
            {{ option }}
          </text>
        </view>
      </view>

      <button
        class="filter-apply"
        @click="applyFilters"
      >
        查看结果
      </button>
    </view>

    <!-- 岗位列表 -->
    <view class="list-container">
      <view
        v-if="loading && list.length === 0"
        class="loading"
      >
        加载中...
      </view>
      <view
        v-else-if="filteredList.length === 0"
        class="empty"
      >
        暂无符合条件的岗位
      </view>
      <view
        v-else
        v-for="item in filteredList"
        :key="item.id"
        class="job-card"
        @click="goToDetail(item)"
      >
        <view class="job-top">
          <view class="job-title-wrap">
            <text class="job-name">{{ item.job_name }}</text>
            <text class="company-name">{{ item.enterprise_name }}</text>
            <text v-if="item.company_address" class="company-address">{{ item.company_address }}</text>
          </view>
          <view class="job-right">
            <text class="job-salary">{{ item.monthly_salary || '薪资面议' }}</text>
            <view
              class="job-fav"
              @click.stop="toggleFavorite(item)"
            >
              <uni-icons
                :type="isFavorite(item) ? 'star-filled' : 'star'"
                size="20"
                :color="isFavorite(item) ? '#ff8558' : '#c8ccd2'"
              />
            </view>
          </view>
        </view>

        <view class="job-tags">
          <text v-if="item.industry" class="job-tag">{{ item.industry }}</text>
          <text v-if="item.enterprise_nature" class="job-tag">{{ item.enterprise_nature }}</text>
          <text v-if="item.enterprise_scale" class="job-tag">{{ item.enterprise_scale }}</text>
          <text
            v-if="item.is_alumni_enterprise === '是'"
            class="job-tag alumni"
          >
            校友企业
          </text>
        </view>

        <view class="job-bottom">
          <text class="job-meta">招 {{ item.recruit_number || '若干' }}</text>
          <text class="job-meta job-major">专业：{{ item.recruit_major || '不限' }}</text>
        </view>
      </view>
    </view>

    <view
      v-if="filteredList.length"
      class="load-more"
    >
      {{ loadingMore ? '加载中...' : hasMore ? '上拉加载更多' : '没有更多了' }}
    </view>

    <view class="data-source">数据由齐鲁人才网&聊城大学毕业生就业指导中心提供支持</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShareAppMessage, onShareTimeline, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { baseURL } from '@/utils/request'

// ========== 通用折叠状态管理 ==========
const collapseStates = ref<Record<string, boolean>>({
  filter: false, // 筛选条件默认收起
})

const toggleCollapse = (type: string) => {
  if (collapseStates.value[type] !== undefined) {
    collapseStates.value[type] = !collapseStates.value[type]
  }
}
// ========== 通用折叠状态管理结束 ==========

// 字段映射配置
const fieldLabels: Record<string, string> = {
  enterprise_name: '企业名称',
  enterprise_nature: '企业性质',
  job_name: '岗位名称',
  industry: '行业',
  recruit_major: '招聘专业',
  monthly_salary: '月薪',
  recruit_number: '招聘人数',
  is_alumni_enterprise: '校友企业',
}

// 筛选字段列表 (与后端一致)
const filterFields = [
  'enterprise_name',
  'enterprise_nature',
  'job_name',
  'industry',
  'recruit_major',
  'monthly_salary',
  'recruit_number',
  'is_alumni_enterprise',
]

// 存储所有筛选选项
const filterOptions = ref<Record<string, string[]>>({})
// 存储当前激活的筛选 (单选逻辑，每个字段选一个)
const activeFilters = ref<Record<string, string>>({})

// 新增：每个筛选维度的折叠状态，默认 false (折叠)
const dimensionCollapseStates = ref<Record<string, boolean>>({})

// 新增：切换单个维度的折叠
const toggleDimensionCollapse = (field: string) => {
  // 如果未初始化，默认为 false，点击后变为 true
  if (dimensionCollapseStates.value[field] === undefined) {
    dimensionCollapseStates.value[field] = true
  } else {
    dimensionCollapseStates.value[field] = !dimensionCollapseStates.value[field]
  }
}

// 排序选项 (动态生成)
const sortOptions = ref<string[]>(['默认排序'])
const sortValues = ref<string[]>([''])
const selectedSortIndex = ref(0)
const selectedSort = computed(() => sortValues.value[selectedSortIndex.value])

// 搜索关键词
const searchKeyword = ref('')

// 快捷分类（数据没有岗位类型字段，这里按岗位名/专业/企业性质做轻量归类）
type QuickKey = 'all' | 'tech' | 'product' | 'intern' | 'state' | 'private' | 'fav'
const quickChips: { key: QuickKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'tech', label: '技术岗' },
  { key: 'product', label: '产品运营' },
  { key: 'intern', label: '实习' },
  { key: 'state', label: '国企' },
  { key: 'private', label: '民企' },
  { key: 'fav', label: '我的收藏' },
]
const quickFilter = ref<QuickKey>('all')

const setQuickFilter = (key: QuickKey) => {
  quickFilter.value = key
}

const matchQuick = (item: any): boolean => {
  const text = `${item.job_name || ''}${item.recruit_major || ''}`
  const nature = String(item.enterprise_nature || '')
  switch (quickFilter.value) {
    case 'tech':
      return /开发|工程师|算法|测试|运维|数据|Java|前端|后端/i.test(text)
    case 'product':
      return /产品|运营|市场|新媒体|策划/i.test(text)
    case 'intern':
      return /实习/.test(text)
    case 'state':
      return /国有|事业/.test(nature)
    case 'private':
      return /民营|民企/.test(nature)
    case 'fav':
      return isFavorite(item)
    default:
      return true
  }
}

const filteredList = computed(() => list.value.filter(matchQuick))

// 收藏（本地）
const FAVORITE_KEY = 'recruitmentFavoriteJobs'
const favoriteIds = ref<string[]>([])
try {
  const raw = uni.getStorageSync(FAVORITE_KEY)
  if (Array.isArray(raw)) favoriteIds.value = raw.map(String)
} catch {
  favoriteIds.value = []
}
const isFavorite = (item: any) => favoriteIds.value.includes(String(item.id))
const toggleFavorite = (item: any) => {
  const id = String(item.id)
  if (favoriteIds.value.includes(id)) {
    favoriteIds.value = favoriteIds.value.filter((x) => x !== id)
    uni.showToast({ title: '已取消收藏', icon: 'none' })
  } else {
    favoriteIds.value = [...favoriteIds.value, id]
    uni.showToast({ title: '已收藏', icon: 'none' })
  }
  uni.setStorageSync(FAVORITE_KEY, favoriteIds.value)
}


// 分页数据
const list = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = computed(() => list.value.length < total.value)

// 新增：跳转页码输入
const jumpPageInput = ref('')

// 新增：处理输入框聚焦
const handleJumpFocus = () => {
  // 聚焦时清空输入框
  jumpPageInput.value = ''
}

// 新增：处理输入框失焦
const handleJumpBlur = () => {
  // 失焦时如果没有输入新值，保持输入框为空（placeholder会显示当前页）
}

// ====================== 登录守卫 ======================

/**
 * 整页只跳一次登录页。
 * 原实现里 fetchFilterOptions 与 fetchList 各自跳一次，
 * 未登录进入时会连续弹出两次登录页。
 */
let loginRedirected = false
const ensureLogin = (): boolean => {
  const token = uni.getStorageSync('accessToken')
  if (token) return true
  if (!loginRedirected) {
    loginRedirected = true
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    uni.navigateTo({ url: '/pagesMember/login/login' })
  }
  return false
}

// ====================== 筛选选项缓存 ======================

/**
 * 筛选选项（企业性质、行业、招聘专业、月薪档位…）几乎不变，
 * 原来每次进页面都要拉 9 个接口。这里加一层本地缓存，命中即用。
 */
const FILTER_CACHE_KEY = 'recruitmentFilterOptionsV2'
const FILTER_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 小时

const readFilterCache = (): Record<string, string[]> | null => {
  try {
    const raw = uni.getStorageSync(FILTER_CACHE_KEY)
    if (!raw || !raw.data || !raw.at) return null
    if (Date.now() - raw.at > FILTER_CACHE_TTL) return null
    return raw.data as Record<string, string[]>
  } catch {
    return null
  }
}

const writeFilterCache = (data: Record<string, string[]>) => {
  try {
    uni.setStorageSync(FILTER_CACHE_KEY, { at: Date.now(), data })
  } catch {
    // 缓存写失败不影响功能
  }
}

/** 把筛选选项落到响应式状态上（缓存与接口两条路径共用） */
const applyFilterOptions = (data: Record<string, string[]>) => {
  Object.keys(data).forEach((field) => {
    let values = Array.isArray(data[field]) ? data[field] : []

    if (field === 'job_name') {
      // 去空格 + 忽略大小写去重，保留第一个展示值
      const seen = new Set<string>()
      values = values.filter((value) => {
        const key = String(value || '').replace(/\s+/g, '').toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    if (field === 'recruit_major') {
      // 把「计算机、软件工程、网络工程」拆成一个个专业
      const majors = new Set<string>()
      values.forEach((value) => {
        String(value || '')
          .split(/[、,，;；/]+/)
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => majors.add(part))
      })
      values = [...majors].sort()
    }

    filterOptions.value[field] = values
    dimensionCollapseStates.value[field] = false
  })
  initSortOptions()
}

// 通用获取筛选选项函数
const fetchFilterOptions = async () => {
  // 先吃缓存：命中就立刻可用，不再阻塞首屏
  const cached = readFilterCache()
  if (cached) {
    applyFilterOptions(cached)
    return
  }

  if (!ensureLogin()) return

  try {
    const token = uni.getStorageSync('accessToken')

    // 构建API路径映射
    const apiMap: Record<string, string> = {
      enterprise_name: 'enterprise-names',
      enterprise_nature: 'enterprise-natures',
      job_name: 'job-names',
      industry: 'industries',
      recruit_major: 'recruit-majors',
      monthly_salary: 'monthly-salaries',
      recruit_number: 'recruit-numbers',
      is_alumni_enterprise: 'is-alumni-enterprises',
    }

    // 并发请求所有筛选数据
    const promises = filterFields.map(async (field) => {
      const apiPath = apiMap[field]
      const res = await uni.request({
        url: `${baseURL}/api/v1/employment/filters/${apiPath}/`,
        method: 'GET',
        header: { Authorization: `JWT ${token}` },
      })
      const responseData = Array.isArray(res) ? res[1] : res
      if (responseData?.statusCode === 200) {
        return { field, data: responseData.data }
      }
      return { field, data: [] }
    })

    const results = await Promise.all(promises)
    const data: Record<string, string[]> = {}
    results.forEach(({ field, data: fieldData }) => {
      data[field] = fieldData
    })

    applyFilterOptions(data)
    writeFilterCache(data)
  } catch (error) {
    console.error('获取筛选选项失败', error)
    uni.showToast({ title: '获取筛选条件失败', icon: 'none' })
  }
}

// 初始化排序选项
const initSortOptions = () => {
  const dbSortFields = [
    { label: '最新发布', val: '-registration_time' },
    { label: '薪资从高到低', val: 'salary_desc' },
    { label: '薪资从低到高', val: 'salary_asc' },
    { label: '企业名称升序', val: 'enterprise_name' },
  ]

  sortOptions.value = ['默认排序', ...dbSortFields.map((i) => i.label)]
  sortValues.value = ['', ...dbSortFields.map((i) => i.val)]
}

const activeFilterCount = computed(
  () => Object.keys(activeFilters.value).filter((key) => !!activeFilters.value[key]).length,
)

const clearSearch = () => {
  searchKeyword.value = ''
  fetchList(1)
}

const applyFilters = () => {
  collapseStates.value.filter = false
  fetchList(1)
}

// 切换筛选标签
const toggleFilter = (field: string, option: string) => {
  if (activeFilters.value[field] === option) {
    // 如果已选中，则取消
    delete activeFilters.value[field]
  } else {
    // 选中新的
    activeFilters.value[field] = option
  }
}

// 处理排序选择
const handleSortChange = (e: any) => {
  selectedSortIndex.value = e.detail.value
  fetchList(1)
}

// 处理搜索确认
const handleSearch = () => {
  fetchList(1)
}

/**
 * 列表请求序号：用于丢弃过期响应。
 * 快速连点筛选/翻页时，先发的请求可能后返回，会把新结果覆盖掉。
 */
let listRequestSeq = 0

// 获取招聘列表数据（append=true 时追加，用于上拉加载）
const fetchList = async (page = currentPage.value, append = false) => {
  if (!ensureLogin()) return

  const seq = ++listRequestSeq
  const wasEmpty = list.value.length === 0
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const token = uni.getStorageSync('accessToken')

    // 构建查询参数
    const params: Record<string, any> = {
      page,
      page_size: pageSize.value,
    }
    if (searchKeyword.value.trim()) {
      params.search = searchKeyword.value.trim()
    }

    // 添加所有激活的筛选条件
    Object.keys(activeFilters.value).forEach((key) => {
      if (activeFilters.value[key]) {
        params[key] = activeFilters.value[key]
      }
    })

    if (selectedSort.value && !['salary_desc', 'salary_asc'].includes(selectedSort.value)) {
      params.ordering = selectedSort.value
    }

    const res = await uni.request({
      url: `${baseURL}/api/v1/employment/recruitments/`,
      method: 'GET',
      header: { Authorization: `JWT ${token}` },
      data: params, // GET 请求参数自动转为查询字符串
    })

    // 期间又发了新请求：丢弃这次结果，避免旧数据覆盖新数据
    if (seq !== listRequestSeq) return

    const responseData = Array.isArray(res) ? res[1] : res
    if (responseData?.statusCode === 200) {
      const data = responseData.data
      let items = data.results || data || []
      const merged = append ? [...list.value, ...items] : items
      if (selectedSort.value === 'salary_desc' || selectedSort.value === 'salary_asc') {
        const dir = selectedSort.value === 'salary_desc' ? -1 : 1
        merged.sort((a: any, b: any) => (salaryValue(a) - salaryValue(b)) * dir)
      }
      list.value = merged
      total.value = data.count || list.value.length
      currentPage.value = page
      jumpPageInput.value = ''
      if (!append && !wasEmpty) {
        uni.pageScrollTo({ scrollTop: 0, duration: 200 })
      }
    } else {
      uni.showToast({ title: '获取列表失败', icon: 'none' })
    }
  } catch (error) {
    if (seq !== listRequestSeq) return
    console.error('获取招聘列表失败', error)
    uni.showToast({ title: '获取列表失败', icon: 'none' })
  } finally {
    if (seq === listRequestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

// 薪资文本转成可比较的数字：7000-12000 → 12000，6k-9k → 9000
const salaryValue = (item: any): number => {
  const text = String(item.monthly_salary || '')
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(k|K|千|万)?/g)].map((m) => {
    const n = Number(m[1])
    if (m[2] === 'k' || m[2] === 'K' || m[2] === '千') return n * 1000
    if (m[2] === '万') return n * 10000
    return n
  })
  return nums.length ? Math.max(...nums) : 0
}

// 切换分页
const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  fetchList(page)
}

// 新增：处理页码跳转
const handleJump = () => {
  const page = parseInt(jumpPageInput.value)

  // 验证是否为正整数
  if (!jumpPageInput.value || isNaN(page) || page <= 0 || !Number.isInteger(page)) {
    uni.showToast({
      title: '请输入正整数',
      icon: 'none',
      duration: 2000,
    })
    return
  }

  // 验证是否超过最大页码
  if (page > totalPages.value) {
    uni.showToast({
      title: '超过最大页面',
      icon: 'none',
      duration: 2000,
    })
    return
  }

  // 执行跳转
  fetchList(page)
}

// 重置筛选
const resetFilter = () => {
  searchKeyword.value = ''
  activeFilters.value = {}
  selectedSortIndex.value = 0
  quickFilter.value = 'all'
  fetchList(1)
}

// 跳转到招聘详情页
const goToDetail = (item: any) => {
  uni.navigateTo({
    url: `/pagesMember/recruitment/recruitment-detail?id=${item.credit_code}`,
  })
}

// 页面初始化
onMounted(() => {
  if (!ensureLogin()) return

  // 筛选选项与列表**并行**请求。
  // 原来写的是「先等筛选选项全部返回，再请求列表」——
  // 列表必须等 9 个筛选接口全部返回才开始，首屏时间被硬生生串行相加。
  fetchFilterOptions()
  fetchList(1)
})

// 上拉加载更多
onReachBottom(() => {
  if (loading.value || loadingMore.value || !hasMore.value) return
  fetchList(currentPage.value + 1, true)
})

// 下拉刷新
onPullDownRefresh(async () => {
  await fetchList(1)
  uni.stopPullDownRefresh()
})

// 分享给好友（小程序端）
onShareAppMessage(() => {
  // 构建分享参数，包含当前筛选条件，方便分享后直接查看对应列表
  let sharePath = '/pagesMember/recruitment/recruitment-list' // 修正为实际页面路径
  const queryParams: Record<string, string> = {}
  if (searchKeyword.value.trim()) {
    queryParams.search = searchKeyword.value.trim()
  }
  // 拼接查询参数到分享路径
  const queryString = Object.keys(queryParams)
    .map((key) => `${key}=${encodeURIComponent(queryParams[key])}`)
    .join('&')
  if (queryString) {
    sharePath += `?${queryString}`
  }

  return {
    title: '招聘信息列表', // 分享标题
    path: sharePath, // 分享页面路径
    imageUrl: 'https://youupro.xyz/notes/static/icons/share-recruitment.png', // 可选：分享图片（需替换为实际图片路径）
  }
})

// 分享到朋友圈（小程序端）
onShareTimeline(() => {
  return {
    title: '最新招聘信息，快来看看！', // 朋友圈分享标题
    imageUrl: 'https://youupro.xyz/notes/static/icons/share-recruitment.png', // 可选：朋友圈分享图片（需替换为实际图片路径）
  }
})
</script>

<style scoped lang="scss">
// 定义渐变变量，适配现有淡橙红色系
$effect2-gradient1: linear-gradient(
  135deg,
  rgba(255, 122, 77, 0.2) 0%,
  rgba(255, 122, 77, 0.4) 100%
);
$effect2-gradient2: linear-gradient(
  135deg,
  rgba(255, 122, 77, 0.4) 0%,
  rgba(255, 122, 77, 0.2) 100%
);

// ========== 通用折叠/展开样式（新特效 + 保留橙红色主题 + 缩短按钮 + 从下到上展开 + 固定在上层） ==========
// 折叠容器样式
.collapse-container {
  position: sticky; // 固定在上层
  top: 0; // 距离顶部0
  z-index: 100; // 确保在最上层
  background-color: #ffffff; // 背景色防止内容透上来
  padding-bottom: 10rpx; // 底部留白
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column; // 内容在上，按钮在下
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

// 折叠内容容器样式（从下到上展开）
.collapse-content {
  overflow: hidden;
  transition:
    transform 0.5s ease,
    height 0.5s ease,
    padding 0.5s ease,
    margin-bottom 0.5s ease;
  transform-origin: bottom; // 从底部开始变换
  height: auto;
  position: relative;
  z-index: 4;
  margin-bottom: 12rpx; /* 内容和按钮之间增加间距 */
  padding: 16rpx; /* 给筛选内容添加内边距 */
  background-color: #ffffff; // 纯白背景
  border-radius: 16rpx; // 圆角适配
}

// 折叠状态样式（收起时从下到上消失）
.collapse-content.collapsed {
  transform: scaleY(0); // 垂直缩放为0
  height: 0;
  padding: 0;
  margin-bottom: 0;

  // 收起时隐藏所有子元素
  .filter-item,
  .filter-btn-group {
    display: none;
  }
}
// ========== 通用折叠/展开样式结束 ==========

// 全局点击元素取消微信默认高亮
.recruitment-list-page {
  min-height: 100vh;
  background-color: #ffffff; // 纯白色背景
  padding: 20rpx;
  -webkit-tap-highlight-color: transparent; // 全局取消微信默认的点击高亮特效
  display: flex;
  flex-direction: column;
}

// 删除原有的 filter-container、filter-header、filter-title、filter-icon 样式，改用通用折叠样式

.filter-item {
  margin-bottom: 20rpx;
  width: 100%;
}

// coolinput样式 - 统一尺寸，改为更淡的橙红色系，背景纯白
.coolinput {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: static;
  max-width: 100%;
}

.coolinput label.text {
  font-size: 24rpx;
  color: #ff7a4d; // 更淡的橙红色（主色减淡）
  font-weight: 700;
  position: relative;
  top: 16rpx;
  margin: 0 0 0 22rpx;
  padding: 0 10rpx;
  background: #ffffff; // 纯白色背景
  width: fit-content;
  z-index: 1;
}

// 统一输入框/选择框高度为70rpx，和原有样式保持一致
.coolinput input[type='text'].input {
  padding: 0 32rpx; // 仅左右内边距，高度由line-height控制
  font-size: 24rpx;
  border: 2rpx #ff7a4d solid; // 更淡的橙红色边框
  border-radius: 12rpx; // 统一圆角
  background: #ffffff; // 纯白色背景
  width: 100%;
  box-sizing: border-box;
  height: 70rpx; // 统一高度
  line-height: 70rpx; // 垂直居中
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
}

.coolinput input[type='text'].input:focus {
  outline: none;
}

// 下拉选择框适配 - 尺寸完全统一
.picker-wrap {
  width: 100%;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
}

.select-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32rpx; // 统一内边距
  font-size: 24rpx;
  border: 2rpx #ff7a4d solid; // 更淡的橙红色边框
  border-radius: 12rpx; // 统一圆角
  background: #ffffff; // 纯白色背景
  width: 100%;
  box-sizing: border-box;
  height: 70rpx; // 统一高度
  line-height: 70rpx; // 垂直居中
}

.select-arrow {
  font-size: 24rpx;
  color: #ff7a4d; // 更淡的橙红色
}

// 新增：筛选标签区域样式
.filter-tags-section {
  margin-bottom: 20rpx;
}

.filter-group-title {
  font-size: 24rpx;
  color: #ff7a4d;
  font-weight: 700;
  margin-bottom: 16rpx;
  margin-left: 10rpx;
}

.filter-dimension {
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
  padding-bottom: 10rpx;
}

// 新增：维度标题行样式
.dimension-header {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
  cursor: pointer;
}

.dimension-arrow {
  font-size: 24rpx;
  color: #ff7a4d;
  margin-right: 10rpx;
  transition: transform 0.3s ease;
  display: inline-block;
}

.dimension-arrow.expanded {
  transform: rotate(90deg); // 展开时箭头旋转
}

.dimension-name {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
}

.dimension-count {
  font-size: 24rpx;
  color: #ff7a4d;
  margin-left: 10rpx;
}

// 新增：标签列表折叠包装器
.tag-list-wrapper {
  overflow: hidden;
  transition:
    max-height 0.3s ease-in-out,
    opacity 0.3s ease-in-out;
  max-height: 1000rpx; // 足够大的高度
  opacity: 1;
}

.tag-list-wrapper.collapsed {
  max-height: 0;
  opacity: 0;
}

// 修改：标签列表样式，改为垂直滚动且多行显示
.tag-list {
  display: flex;
  // 核心修改：允许换行
  flex-wrap: wrap;
  // 核心修改：改为垂直滚动
  overflow-y: auto;
  overflow-x: hidden;
  gap: 12rpx;
  padding-top: 10rpx;
  padding-bottom: 10rpx;
  // 核心修改：限制最大高度为约4行的高度 (可根据实际标签高度调整)
  max-height: 260rpx;
  // 隐藏滚动条但保留功能
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

// 修改：标签项样式，允许自然收缩
.tag-item {
  // 移除 flex-shrink: 0，允许在换行布局中自然排列
  padding: 8rpx 20rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #333;
  border: 1px solid #eee;
  transition: all 0.2s;
}

.tag-item.active {
  background: #ff8a54;
  color: #fff;
  border-color: #ff7a4d;
}

.filter-btn-group {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.reset-btn {
  flex: 1;
  height: 70rpx;
  line-height: 70rpx;
  background-color: #ffffff; // 纯白色背景
  color: #333;
  border: 1px solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-shadow: 4rpx 4rpx 10rpx 0rpx #0000001a;
  transition: all 0.3s;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  &::after {
    border: none;
  }

  &:active {
    box-shadow: none;
    opacity: 0.9;
  }
}

// 调整立即筛选按钮尺寸，与重置筛选一致（渐变也减淡）
.filter-btn {
  flex: 1;
  height: 70rpx;
  line-height: 70rpx;
  // 背景渐变改为更淡的橙红色系
  background:
    linear-gradient(140.14deg, hsl(16, 100%, 61%) 15.05%, #f15010 114.99%) padding-box,
    linear-gradient(142.51deg, #ff7a4d 8.65%, #dc5d32 88.82%) border-box;
  border-radius: 12rpx;
  border: 2rpx solid transparent;

  text-shadow: 1rpx 1rpx 2rpx #00000040;
  box-shadow: 8rpx 8rpx 20rpx 0rpx #45090030; // 阴影也减淡
  padding: 0 20rpx;
  cursor: pointer;
  transition: all 0.3s;
  color: white;
  font-size: 28rpx;
  font-weight: 500;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  &::after {
    border: none;
  }

  &:active {
    box-shadow: none;
    opacity: 0.8;
  }
}

.list-container {
  background-color: #ffffff; // 纯白色背景
  border-radius: 16rpx;
  padding: 16rpx;
  flex: 1;
  margin-bottom: 20rpx;
}

.loading,
.empty {
  text-align: center;
  padding: 50rpx 0;
  font-size: 26rpx;
  color: #999;
}

// 列表项点击特效 - 核心修改部分
.list-item {
  padding: 16rpx 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  position: relative; // 为伪元素提供定位上下文
  z-index: 1; // 确保伪元素在下方
  overflow: hidden; // 隐藏超出的伪元素
  border-radius: 10rpx; // 圆角适配特效
  border: 1rpx solid #ff7a4d; // 淡橙红色边框，适配现有主题
  margin-bottom: 12rpx; // 增加间距，优化视觉
  padding: 16rpx; // 内边距优化

  &:last-child {
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 0;
  }

  // 左侧渐变伪元素
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: 0;
    height: 100%;
    transform: skew(15deg);
    transition: all 0.5s;
    overflow: hidden;
    z-index: -1;
  }

  &::before {
    left: -10rpx;
    background: #fff7f2; // 淡橙红底1
  }

  &::after {
    right: -10rpx;
    background: #fff3ec; // 淡橙红底2
  }

  // 点击时展开渐变背景
  &:active::before,
  &:active::after {
    width: 58%;
  }

  // 点击时文字变色
  &:active .item-title,
  &:active .info-item {
    color: #e03e00; // 深一点的橙红色，提升对比
    transition: 0.3s;
  }
}

.item-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 10rpx;
  transition: all 0.3s ease-in; // 文字过渡效果
}

.item-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 6rpx;
  transition: all 0.3s ease-in; // 文字过渡效果
}

.info-item {
  padding: 3rpx 6rpx;
}

.info-item.alumni {
  color: #ff7a4d; // 更淡的橙红色
  background-color: #fff8f5; // 更浅的淡橙色背景
  border-radius: 4rpx;
}

// 分页布局
.pagination {
  display: flex;
  align-items: center;
  justify-content: center; // 居中对齐
  padding: 16rpx 0;
  font-size: 24rpx;
  color: #666;
  gap: 30rpx; // 固定间距
  margin-bottom: 20rpx;
  max-width: 600rpx;
  margin-left: auto;
  margin-right: auto;
  align-items: center;
}

// 分页按钮新样式 - 缩小至原有尺寸的2/3，橙红色系
.button,
.page-btn {
  --primary: #ff7a4d; // 主色（橙红色，和页面其他元素统一）
  --border-color: #e03e00; // 边框色/阴影色（深橙红色）
  --shadow-color: #ff7a4d63; // 投影色（浅橙红色半透明）
  cursor: pointer;
  width: calc(184rpx * 2 / 3); // 宽度缩小至2/3
  height: calc(48rpx * 2 / 3); // 高度缩小至2/3
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(16rpx * 2 / 3); // 内部间距缩小至2/3
  font-size: calc(32rpx * 2 / 3); // 字体大小缩小至2/3
  font-weight: 800;
  letter-spacing: calc(2rpx * 2 / 3); // 字间距缩小至2/3
  color: #fff;
  background: var(--primary);
  border: calc(2rpx * 2 / 3) solid var(--border-color); // 边框宽度缩小至2/3
  border-radius: calc(24rpx * 2 / 3); // 圆角缩小至2/3
  box-shadow: 0 calc(8rpx * 2 / 3) 0 var(--border-color); // 阴影偏移缩小至2/3
  transform: skew(-10deg);
  transition: all 0.1s ease;
  filter: drop-shadow(
    0 calc(15rpx * 2 / 3) calc(20rpx * 2 / 3) var(--shadow-color)
  ); // 投影大小缩小至2/3
  -webkit-tap-highlight-color: transparent; // 取消微信默认高亮
  padding-left: 10rpx;
  padding-right: 10rpx;
  flex-shrink: 0; // 防止按钮被压缩
}

// 按钮点击效果（同步缩小）
.button:active,
.page-btn:active {
  letter-spacing: 0rpx;
  transform: skew(-10deg) translateY(calc(8rpx * 2 / 3)); // 点击位移缩小至2/3
  box-shadow: 0 0 0 var(--shadow-color);
}

// 按钮占位符样式，尺寸和按钮完全一致
.page-btn-placeholder {
  width: calc(184rpx * 2 / 3); // 和按钮宽度一致
  height: calc(48rpx * 2 / 3); // 和按钮高度一致
  flex-shrink: 0; // 防止占位符被压缩
  background: transparent; // 透明背景，不可见
}

// 核心新增：页码信息 + 跳转功能 容器样式
.page-info-with-jump {
  display: flex;
  align-items: center;
  gap: 12rpx; // 元素之间的间距
  flex-shrink: 0; // 防止被压缩
  min-width: 280rpx; // 最小宽度保证布局稳定
  margin-left: 54rpx; // 向右偏移40rpx
}

// 页码显示样式
.page-total {
  font-size: 24rpx;
  color: #666;
  line-height: 1.2;
  flex-shrink: 0;
}

// 跳转输入框样式
.jump-input {
  width: 80rpx;
  height: 56rpx;
  border: 2rpx solid #ff7a4d; // 橙红色边框
  border-radius: 8rpx;
  background: #ffffff;
  text-align: center;
  font-size: 24rpx;
  color: #333;
  flex-shrink: 0;

  // 占位符样式
  &::placeholder {
    color: #999;
    font-size: 24rpx;
  }
}

// 跳转按钮样式
.jump-btn {
  width: 80rpx;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0;
  margin: 0;
  background: #ff7a4d; // 橙红色背景
  color: #ffffff;
  border: none;
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: 500;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;

  // 重置uni-app button默认样式
  &::after {
    border: none;
  }

  // 点击效果
  &:active {
    background: #e03e00; // 深一点的橙红色
  }
}

// 数据来源说明样式
.data-source {
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
  margin-bottom: 30rpx;
  padding: 0 20rpx;
  // 核心修改：文字斜体
  font-style: italic;
}

/* 翻页/筛选时的轻量刷新提示（不遮挡列表） */
.refreshing {
  text-align: center;
  font-size: 24rpx;
  color: #ff4500;
  padding: 12rpx 0;
  margin-bottom: 8rpx;
  background: #fff5f0;
  border-radius: 12rpx;
}
/* ====================== 岗位列表新版 ====================== */
.recruitment-list-page {
  background: #f5f6f8;
}

.list-top {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  height: 76rpx;
  padding: 0 20rpx;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.search-input {
  flex: 1;
  margin-left: 12rpx;
  font-size: 26rpx;
  color: #17191c;
}

.search-clear {
  padding: 0 8rpx;
  font-size: 30rpx;
  color: #9aa0a8;
}

.filter-toggle {
  display: flex;
  align-items: center;
  height: 76rpx;
  margin-left: 16rpx;
  padding: 0 20rpx;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 12rpx;
}

.filter-toggle-text {
  margin-left: 8rpx;
  font-size: 26rpx;
  color: #17191c;
}

.filter-badge {
  min-width: 28rpx;
  height: 28rpx;
  margin-left: 8rpx;
  padding: 0 6rpx;
  font-size: 20rpx;
  line-height: 28rpx;
  text-align: center;
  color: #ffffff;
  background: #ff8558;
  border-radius: 14rpx;
  box-sizing: border-box;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.result-count {
  font-size: 24rpx;
  color: #9aa0a8;
}

.sort-picker {
  display: flex;
  align-items: center;
  max-width: 420rpx;
}

.sort-text {
  max-width: 380rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 24rpx;
  color: #5b616b;
}

.filter-panel {
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 16rpx;
}

.filter-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.filter-panel-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #17191c;
}

.filter-reset {
  font-size: 24rpx;
  color: #9aa0a8;
}

.filter-group {
  border-top: 1rpx solid #f2f3f5;
}

.filter-group-head {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
}

.filter-group-name {
  flex: 1;
  font-size: 26rpx;
  color: #17191c;
}

.filter-group-value {
  max-width: 300rpx;
  margin-right: 12rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 24rpx;
  color: #ff8558;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  padding-bottom: 16rpx;
}

.filter-chip {
  margin: 0 12rpx 12rpx 0;
  padding: 8rpx 18rpx;
  font-size: 24rpx;
  color: #5b616b;
  background: #f7f8fa;
  border: 1rpx solid transparent;
  border-radius: 8rpx;
}

.filter-chip.active {
  color: #b23c17;
  background: #fff3ed;
  border-color: #ffd2bf;
}

.filter-apply {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #ffffff;
  background: #ff8558;
  border-radius: 10rpx;

  &::after {
    border: none;
  }
}

.list-container {
  padding: 0;
  margin-bottom: 16rpx;
  background: transparent;
}

.job-card {
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 16rpx;
}

.job-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.job-title-wrap {
  flex: 1;
  min-width: 0;
  padding-right: 20rpx;
}

.job-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #17191c;
  line-height: 1.4;
}

.company-name {
  display: block;
  margin-top: 6rpx;
  font-size: 26rpx;
  color: #5b616b;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.job-salary {
  flex: none;
  font-size: 30rpx;
  font-weight: 600;
  color: #ff8558;
}

.company-address {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #9aa0a8;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.job-tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 14rpx;
}

.job-tag {
  margin: 0 12rpx 8rpx 0;
  padding: 4rpx 12rpx;
  font-size: 24rpx;
  color: #5b616b;
  background: #f7f8fa;
  border-radius: 6rpx;
}

.job-tag.alumni {
  color: #b23c17;
  background: #fff3ed;
}

.job-bottom {
  display: flex;
  align-items: center;
  margin-top: 6rpx;
}

.job-meta {
  flex: none;
  font-size: 24rpx;
  color: #9aa0a8;
}

.job-major {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pagination {
  padding: 12rpx 0 20rpx;
}

.pagination .page-btn {
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: #17191c;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 8rpx;
}

.pagination .page-btn.disabled {
  color: #c8ccd2;
}

.page-info {
  margin: 0 20rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.list-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  padding-top: 8rpx;
  padding-bottom: 12rpx;
  margin-bottom: 4rpx;
  background: #f5f6f8;
}

.quick-scroll {
  white-space: nowrap;
  margin-bottom: 12rpx;
}

.quick-chips {
  display: inline-flex;
  padding-right: 20rpx;
}

.quick-chip {
  flex: none;
  margin-right: 12rpx;
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: #5b616b;
  background: #ffffff;
  border: 1rpx solid #ececf0;
  border-radius: 999rpx;
}

.quick-chip.active {
  color: #ffffff;
  background: #ff8558;
  border-color: #ff8558;
}

.job-right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.job-fav {
  margin-top: 10rpx;
  padding: 4rpx;
}

.load-more {
  padding: 20rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #9aa0a8;
}

</style>
