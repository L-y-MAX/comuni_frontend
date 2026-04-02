import { baseURL } from '@/utils/request';
import { debounce } from 'lodash'
import { ref } from 'vue'

// 1. 补充知识库类型定义（匹配后端返回字段）
interface KnowledgeBase {
  id: string | number;
  name: string;
  description?: string;
  short_id?: string; // 新增：匹配后端返回的short_id字段
  is_public?: boolean; // 新增：匹配后端返回的is_public字段
  creator?: string | number; // 修正：后端返回creator而非creator_id
  is_followed?: boolean; // 是否已关注
  created_at?: string;
  updated_at?: string;
}

// 精准适配后端返回的 Node 类型（对应原 documents）
interface SearchResultNode {
  id: string | number; // 兼容UUID/数字ID
  name: string;
  content?: string;
  description?: string;
  knowledge_base_id?: string | number;
  created_at?: string;
  updated_at?: string;
  creator?: string; // 补充后端实际返回的创建者字段
  knowledge_base?: string; // 补充知识库名称/ID字段
  creator_user_id?: string; // 补充知识库名称/ID字段
  creator_username?: string; // 补充知识库名称/ID字段
  knowledge_base_name?: string; // 补充知识库名称/ID字段
}

// 统一用户类型（合并原有User和SearchResultUser，避免类型冗余）
export interface User {
  id:               string;
  gender_text:      string;
  avatar_text:      string;
  is_followed:      boolean;
  vip_info:         VipInfo;
  password:         string;
  last_login:       string; // 修正：后端返回字符串而非Date类型
  is_superuser:     boolean;
  username:         string;
  first_name:       string;
  last_name:        string;
  is_staff:         boolean;
  is_active:        boolean;
  date_joined:      string; // 修正：后端返回字符串而非Date类型
  user_id:          string;
  email:            string;
  gender:           string;
  wechat_openid:    null;
  avatar:           string;
  bio:              string;
  is_private:       boolean;
  created_at:       string; // 修正：后端返回字符串而非Date类型
  updated_at:       string; // 修正：后端返回字符串而非Date类型
  totp_secret:      null;
  is_totp_enabled:  boolean;
  backup_codes:     string;
  groups:           any[];
  user_permissions: any[];
}

export interface VipInfo {
  isVip:      boolean;
  expireDate: null;
}

// 适配后端返回的响应结构（完全对齐后端返回）
interface SearchResponse {
  code: number;
  msg: string;
  count: number;
  next: string | null;
  previous: string | null;
  results: {
    comments: any[];
    knowledge_bases: KnowledgeBase[]; // 补充知识库类型
    nodes: SearchResultNode[];
    tags: any[];
    users: User[]; // 统一使用User类型
  };
}

// 2. 响应式数据
export const searchKeyword = ref<string>('')
export const searchResult = ref<SearchResponse | null>(null)
export const isLoading = ref<boolean>(false)
export const isSearching = ref<boolean>(false)

// 半屏弹窗相关
export const showKnowledgeModal = ref<boolean>(false) // 半屏弹窗显示状态
export const currentDoc = ref<SearchResultNode | null>(null) // 当前要添加的文档
export const myKnowledgeBases = ref<KnowledgeBase[]>([]) // 我的知识库列表
export const isLoadingKB = ref<boolean>(false) // 获取知识库列表加载状态
export const newKBName = ref<string>('') // 新建知识库名称
export const isCreatingKB = ref<boolean>(false) // 创建知识库加载状态

// 输入框聚焦/失焦逻辑
export const handleInputFocus = () => {
  isSearching.value = true
}

export const handleInputBlur = () => {
  if (!searchKeyword.value.trim() && !isLoading.value) {
    isSearching.value = false
  }
}

// 3. 获取我的知识库列表
export const getMyKnowledgeBases = async () => {
  try {
    isLoadingKB.value = true
    const accessToken = uni.getStorageSync('accessToken')

    if (!accessToken) {
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: `${baseURL}/api/v1/knowledge/knowledgebase/my-knowledge-bases/`,
        method: 'GET',
        header: {
          'Authorization': `JWT ${accessToken}`,
          'Content-Type': 'application/json'
        },
        success: resolve,
        fail: reject
      })
    })

    // 修复核心：正确处理返回数据，UniApp的request返回数据在data字段中
    if (res.statusCode === 200) {
      // 先判断返回数据结构，优先取data中的results，没有则直接取data
      const responseData = res.data as { results?: KnowledgeBase[] } | KnowledgeBase[]

      // 适配两种常见的后端返回格式
      if (Array.isArray(responseData)) {
        // 格式1：直接返回数组 [{}, {}, ...]
        myKnowledgeBases.value = responseData
      } else if (responseData?.results) {
        // 格式2：分页返回 { results: [{}, ...], count: 10 }
        myKnowledgeBases.value = responseData.results
      } else {
        // 兜底：如果都不符合，尝试将data转为数组
        myKnowledgeBases.value = []
        console.warn('知识库列表返回格式不符合预期', res.data)
      }
    } else {
      // 非200状态码的错误提示
      uni.showToast({
        title: `获取失败：状态码${res.statusCode}`,
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('获取我的知识库失败：', error)
    uni.showToast({ title: '获取知识库列表失败', icon: 'none' })
  } finally {
    isLoadingKB.value = false
  }
}

// 新增：获取我关注的知识库列表
export const getFollowedKnowledgeBases = async () => {
  try {
    const accessToken = uni.getStorageSync('accessToken')
    if (!accessToken) {
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return []
    }

    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: `${baseURL}/api/v1/knowledge/knowledgebase/followed-knowledge-bases/`,
        method: 'GET',
        header: {
          'Authorization': `JWT ${accessToken}`,
          'Content-Type': 'application/json'
        },
        success: resolve,
        fail: reject
      })
    })

    if (res.statusCode === 200) {
      const responseData = res.data as { results?: KnowledgeBase[] }
      const followedKBList = responseData?.results || []
      // 更新本地关注列表
      followedKBs.value = followedKBList.map(kb => kb.id)
      // 持久化
      uni.setStorageSync('followedKBs', JSON.stringify(followedKBs.value))
      return followedKBList
    }
    return []
  } catch (error) {
    console.error('获取关注的知识库失败：', error)
    uni.showToast({ title: '获取关注的知识库失败', icon: 'none' })
    return []
  }
}

// 4. 创建新知识库
export const createKnowledgeBase = async () => {
  if (!newKBName.value.trim()) {
    uni.showToast({ title: '请输入知识库名称', icon: 'none' })
    return
  }

  try {
    isCreatingKB.value = true
    const accessToken = uni.getStorageSync('accessToken')
    const userInfo = uni.getStorageSync('userInfo') // 获取当前登录用户信息
    if (!accessToken) {
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: `${baseURL}/api/v1/knowledge/knowledgebase/`,
        method: 'POST',
        header: {
          'Authorization': `JWT ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: newKBName.value.trim(),
          description: '从搜索结果添加文档创建的知识库',
          // 显式传递creator字段（用户ID），避免后端校验报错
          creator: userInfo?.id || userInfo?.userId // 兼容不同的用户ID字段名
        },
        success: resolve,
        fail: reject
      })
    })

    if (res.statusCode === 201) {
      const newKB = res.data as KnowledgeBase
      myKnowledgeBases.value.push(newKB)
      uni.showToast({ title: '知识库创建成功', icon: 'success' })
      // 自动将文档添加到新创建的知识库
      await addDocToKnowledgeBase(currentDoc.value!, newKB.id)
    } else {
      // 显示具体的错误信息
      const responseData = res.data as { msg?: string; detail?: string; creator?: string[] };
      const errMsg = responseData?.msg || responseData?.detail ||
        (responseData?.creator?.length ? responseData.creator[0] : '创建知识库失败');
      uni.showToast({ title: errMsg, icon: 'none' })
    }
  } catch (error) {
    console.error('创建知识库失败：', error)
    uni.showToast({ title: '创建知识库失败', icon: 'none' })
  } finally {
    isCreatingKB.value = false
    newKBName.value = ''
  }
}

// 5. 将文档添加到指定知识库
export const addDocToKnowledgeBase = async (doc: SearchResultNode, kbId: string | number) => {
  if (!doc.id || !kbId) {
    uni.showToast({ title: '文档ID或知识库ID不能为空', icon: 'none' })
    return
  }

  try {
    const accessToken = uni.getStorageSync('accessToken')
    if (!accessToken) {
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    // 调用添加文档到知识库的接口（URL已匹配后端新增接口）
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: `${baseURL}/api/v1/knowledge/knowledgebase/${kbId}/nodes/${doc.id}/copy/`,
        method: 'POST',
        header: {
          'Authorization': `JWT ${accessToken}`,
          'Content-Type': 'application/json'
        },
        success: resolve,
        fail: reject
      })
    })

    // 【修复TypeScript类型错误】对res.data做类型断言和安全访问
    const responseData = res.data as { msg?: string; detail?: string }; // 类型断言为包含msg/detail的对象
    const errorMsg = responseData?.msg || responseData?.detail || '未知错误'; // 兼容后端可能返回的detail字段

    // 适配后端响应码和提示
    if (res.statusCode === 201) {
      uni.showToast({ title: '文档添加成功', icon: 'success' })
      showKnowledgeModal.value = false // 关闭半屏弹窗
    } else if (res.statusCode === 403) {
      uni.showToast({ title: '无权限添加文档到该知识库', icon: 'none' })
    } else if (res.statusCode === 404) {
      uni.showToast({ title: '文档或知识库不存在', icon: 'none' })
    } else {
      uni.showToast({ title: `添加失败：${errorMsg}`, icon: 'none' })
    }
  } catch (error) {
    console.error('添加文档到知识库失败：', error)
    uni.showToast({ title: '添加文档失败，请检查网络', icon: 'none' })
  }
}

// 6. 打开半屏弹窗（修改原addToMyKnowledge逻辑）
export const openKnowledgeModal = (doc: SearchResultNode) => {
  currentDoc.value = doc
  showKnowledgeModal.value = true
  getMyKnowledgeBases() // 打开弹窗时获取我的知识库列表
}

// 7. 核心搜索逻辑（完整适配新数据结构 + 修复赋值问题）
export const handleSearch = debounce(async () => {
  const keyword = searchKeyword.value.trim()

  // 空关键词处理（补全缺失的count/next/previous字段，避免类型报错）
  if (!keyword) {
    searchResult.value = {
      code: 400,
      msg: '搜索关键词不能为空',
      count: 0,
      next: null,
      previous: null,
      results: {
        users: [],
        knowledge_bases: [],
        nodes: [],
        tags: [],
        comments: []
      }
    }
    return
  }

  try {
    // 登录校验
    const userInfo = uni.getStorageSync('userInfo')
    const accessToken = uni.getStorageSync('accessToken')

    if (!userInfo || !accessToken) {
      console.warn('请登录进行站内搜索')
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    isLoading.value = true
    isSearching.value = true

    const encodedKeyword = encodeURIComponent(keyword)
    const apiUrl = `${baseURL}/api/v1/search/global/?keyword=${encodedKeyword}`

    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: apiUrl,
        method: 'GET',
        withCredentials: true,
        header: {
          'Authorization': `JWT ${accessToken}`,
          'Content-Type': 'application/json'
        },
        success: resolve,
        fail: reject,
      })
    })

    // 响应数据校验
    if (res.statusCode !== 200) {
      throw new Error(`请求失败：${res.errMsg || `状态码${res.statusCode}`}`)
    }

    const result = res.data as SearchResponse
    // 修复核心：将接口返回结果赋值给响应式数据，页面才能获取到数据
    searchResult.value = result

  } catch (error: any) {
    console.error('搜索失败：', error)
    // 错误返回补全所有必填字段，避免页面渲染报错
    searchResult.value = {
      code: 500,
      msg: `搜索失败：${error.message || error.errMsg || '网络异常'}`,
      count: 0,
      next: null,
      previous: null,
      results: {
        users: [],
        knowledge_bases: [],
        nodes: [],
        tags: [],
        comments: []
      },
    }
  } finally {
    isLoading.value = false
  }
}, 500)

// 8. 统计结果数（支持多维度统计，兼容新旧结构）
export const getResultCount = (result: SearchResponse): number => {
  // 统计所有类型结果总数
  const total = (result.results?.users?.length || 0) +
                (result.results?.nodes?.length || 0) +
                (result.results?.knowledge_bases?.length || 0) +
                (result.results?.tags?.length || 0) +
                (result.results?.comments?.length || 0)
  // 优先返回后端count，无则返回计算值
  return result.count || total
}

// 9. 高亮关键词方法（优化 Markdown 内容处理）
export const highlightKeyword = (text: string | undefined | null): string => {
  if (!text || !searchKeyword.value) return ''

  const keyword = searchKeyword.value.trim()
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reg = new RegExp(`(${escapedKeyword})`, 'gi')

  // 处理 Markdown 语法，避免高亮破坏格式
  return text.replace(reg, '<mark class="highlight">$1</mark>')
}

// 10. 跳转到知识库详情（适配新的 node 结构）
export const navigateToKnowledge = (doc: SearchResultNode) => {
  if (!doc.id) return

  uni.navigateTo({
    url: `/pagesMember/knowledge/showNode/showNode?id=${encodeURIComponent(doc.id as string)}&kbId=${encodeURIComponent(doc.knowledge_base_id as string)}`
  })
}

// ========== 头像相关逻辑（和user-detail页面保持一致） ==========
// 生成头像背景色（基于用户名哈希）
export const getAvatarColor = (item: any) => {
  const username = item.username || 'default'
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  // 生成 pastel 风格颜色
  const color = `hsl(${hash % 360}, 70%, 80%)`
  return color
}

// 获取头像显示文字
export const getAvatarText = (item: any) => {
  const username = item.username
  return username ? username.substring(0, 1).toUpperCase() : '?'
}

// 格式化时间
export const formatTime = (timeStr: string) => {
  if (!timeStr) return '未知'
  const date = new Date(timeStr)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 11. 关注相关逻辑 - 用户（完全替换为新接口）
// 判断是否关注用户（基于后端返回的is_followed字段）
export const isFollowed = (user: User | undefined | null): boolean => {
  return !!user?.is_followed
}

// 关注/取消关注用户（使用follow_user/unfollow_user接口）
export const followUser = async (user: User | undefined | null) => {
  // 第一步：校验user参数是否存在
  if (!user) {
    uni.showToast({ title: '用户信息不能为空', icon: 'none' })
    return
  }

  // 第二步：校验用户ID（优先用user_id，兼容id）
  const userId = user.user_id || user.id
  if (!userId) {
    uni.showToast({ title: '用户ID不能为空', icon: 'none' })
    return
  }

  try {
    const token = uni.getStorageSync('accessToken')

    if (!token) {
      uni.showToast({ title: '请先登录', icon: 'none' })
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    // 当前关注状态（基于后端返回的is_followed）
    const isCurrentFollowed = isFollowed(user)
    // 确定接口URL、请求方法和提示文案
    const config = isCurrentFollowed
      ? {
          apiUrl: `${baseURL}/api/v1/auth/users/user/unfollow_user/`,
          method: 'DELETE' as const, // 取消关注用DELETE方法
          successMsg: '已取消关注'
        }
      : {
          apiUrl: `${baseURL}/api/v1/auth/user/follow/follow-user/`,
          method: 'POST' as const, // 关注用POST方法
          successMsg: '关注成功'
        };

    // 调用接口（根据状态使用不同的请求方法）
    const response = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: config.apiUrl,
        method: config.method, // 动态使用POST/DELETE方法
        header: {
          'Authorization': `JWT ${token}`,
          'Content-Type': 'application/json'
        },
        data: { followed_user_id: userId }, // 传递用户ID参数（DELETE请求也可携带data）
        success: resolve,
        fail: reject
      })
    })

    // 处理响应（兼容200/204成功状态码）
    if ([200, 204].includes(response.statusCode)) {
      // 更新用户对象的关注状态（响应式更新页面）
      user.is_followed = !isCurrentFollowed
      uni.showToast({ title: config.successMsg, icon: 'success' })
    } else {
      // 显示具体错误信息
      const errMsg = (response.data as { msg?: string; detail?: string })?.msg ||
                    (response.data as { msg?: string; detail?: string })?.detail ||
                    (isCurrentFollowed ? '取消关注失败' : '关注失败')
      uni.showToast({ title: errMsg, icon: 'none' })
    }
  } catch (error: any) {
    console.error('关注操作失败：', error)
    uni.showToast({
      title: `操作失败：${error.message || '网络异常'}`,
      icon: 'none'
    })
  }
}

// 12. 关注/取消关注知识库
export const followedKBs = ref<(string | number)[]>([]) // 已关注的知识库ID列表

// 初始化已关注知识库
const initFollowedKBs = () => {
  try {
    const saved = uni.getStorageSync('followedKBs')
    return saved ? JSON.parse(saved) : []
  } catch (e) {
    console.error('初始化关注知识库列表失败：', e)
    return []
  }
}

// 初始化已关注知识库列表
followedKBs.value = initFollowedKBs()

// 判断是否关注知识库
export const isFollowedKB = (kbId: string | number): boolean => {
  return followedKBs.value.includes(kbId)
}

// 关注/取消关注知识库（适配后端UserFollowKnowledgeBaseViewSet接口）
export const followKB = async (kb: KnowledgeBase) => {
  if (!kb.id) return

  try {
    const token = uni.getStorageSync('accessToken')
    if (!token) {
      uni.showToast({ title: '请先登录', icon: 'none' })
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    const isCurrentFollowed = isFollowedKB(kb.id)
    let response: UniApp.RequestSuccessCallbackResult | any

    if (isCurrentFollowed) {
      // 取消关注：调用后端专门的unfollow接口
      response = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: `${baseURL}/api/v1/knowledge/user-follow-knowledgebase/unfollow/`,
          method: 'POST',
          header: { // 修复：将headers改为header（单数）
            'Authorization': `JWT ${token}`,
            'Content-Type': 'application/json'
          },
          data: { knowledge_base: kb.id },
          success: resolve,
          fail: reject
        })
      })
    } else {
      // 关注：创建关注记录
      response = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: `${baseURL}/api/v1/knowledge/user-follow-knowledgebase/`,
          method: 'POST',
          header: { // 修复：将headers改为header（单数）
            'Authorization': `JWT ${token}`,
            'Content-Type': 'application/json'
          },
          data: { knowledge_base: kb.id },
          success: resolve,
          fail: reject
        })
      })
    }

    // 处理响应（后端返回200表示成功）
    if (response.statusCode === 200 && response.data?.code === 200) {
      if (isCurrentFollowed) {
        // 取消关注
        followedKBs.value = followedKBs.value.filter(id => id !== kb.id)
        uni.showToast({ title: '已取消关注', icon: 'none' })
      } else {
        // 关注
        followedKBs.value.push(kb.id)
        uni.showToast({ title: '关注知识库成功', icon: 'none' })
      }
      // 持久化关注列表
      uni.setStorageSync('followedKBs', JSON.stringify(followedKBs.value))
    } else {
      const errMsg = response.data?.msg || (isCurrentFollowed ? '取消关注知识库失败' : '关注知识库失败')
      uni.showToast({
        title: errMsg,
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('关注知识库操作失败：', error)
    uni.showToast({ title: '网络异常，请重试', icon: 'none' })
  }
}

// 13. 跳转到用户详情页（修复参数传递问题）
export const navigateToUserDetail = (user: User) => {
  // 优先使用user_id（必选字段），兼容id字段，增加空值校验
  const userId = user.user_id || user.id
  if (!userId) {
    uni.showToast({ title: '用户ID为空，无法跳转', icon: 'none' })
    return
  }

  try {
    // 修复：对所有参数进行encodeURIComponent，避免特殊字符导致参数丢失
    uni.navigateTo({
      url: `/pagesMember/user-detail/user-detail?userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(user.username || '')}`
    })
  } catch (e) {
    console.error('跳转到用户主页失败：', e)
    uni.showToast({ title: '跳转失败，请重试', icon: 'none' })
  }
}

// 14. 格式化性别显示（适配 gender_text 字段）
export const formatGender = (genderText: string | null | undefined): string => {
  const genderMap: Record<string, string> = {
    '未填写': '未知',
    '男': '男',
    '女': '女',
    '未知': '未知',
    '隐藏': '隐藏' // 补充：适配“隐藏”场景
  }
  return genderMap[genderText || '未填写'] || '未知'
}

// ========== 新增：微信小程序分享相关逻辑 ==========
/**
 * 生成分享给好友的参数（供页面onShareAppMessage调用）
 * @param shareTarget 分享目标（可选：搜索关键词/文档/用户/知识库）
 * @returns 分享参数
 */
export const getShareAppMessageParams = (shareTarget?: {
  type: 'search' | 'doc' | 'user' | 'kb',
  data: SearchResultNode | User | KnowledgeBase | string
}) => {
  // 默认分享标题和路径
  let title = '知识搜索平台'
  let path = '/pagesMember/search/search'
  const imageUrl = `${baseURL}/notes/static/icons/share-icon.png` // 替换为实际分享图片地址

  // 根据分享目标定制参数
  if (shareTarget) {
    const { type, data } = shareTarget
    switch (type) {
      case 'search':
        // 分享搜索关键词
        title = `搜索：${data as string}`
        path = `/pagesMember/search/search?keyword=${encodeURIComponent(data as string)}`
        break
      case 'doc':
        // 分享文档
        const doc = data as SearchResultNode
        title = `文档：${doc.name}`
        path = `/pagesMember/knowledge/showNode/showNode?id=${encodeURIComponent(doc.id as string)}&kbId=${encodeURIComponent(doc.knowledge_base_id as string)}`
        break
      case 'user':
        // 分享用户
        const user = data as User
        title = `用户：${user.username}`
        path = `/pagesMember/user-detail/user-detail?userId=${encodeURIComponent(user.user_id || user.id)}&username=${encodeURIComponent(user.username || '')}`
        break
      case 'kb':
        // 分享知识库
        const kb = data as KnowledgeBase
        title = `知识库：${kb.name}`
        path = `/pagesMember/knowledge/knowledge?kbId=${encodeURIComponent(kb.id as string)}`
        break
    }
  }

  return {
    title,
    path,
    imageUrl
  }
}

/**
 * 生成分享到朋友圈的参数（供页面onShareTimeline调用）
 * @param shareTarget 分享目标（可选：搜索关键词/文档/用户/知识库）
 * @returns 分享参数
 */
export const getShareTimelineParams = (shareTarget?: {
  type: 'search' | 'doc' | 'user' | 'kb',
  data: SearchResultNode | User | KnowledgeBase | string
}) => {
  // 默认分享标题和查询参数
  let title = '知识搜索平台'
  let query = ''
  const imageUrl = `${baseURL}/notes/static/icons/share-icon.png` // 替换为实际分享图片地址

  // 根据分享目标定制参数
  if (shareTarget) {
    const { type, data } = shareTarget
    switch (type) {
      case 'search':
        // 分享搜索关键词
        title = `搜索：${data as string}`
        query = `keyword=${encodeURIComponent(data as string)}`
        break
      case 'doc':
        // 分享文档
        const doc = data as SearchResultNode
        title = `文档：${doc.name}`
        query = `id=${encodeURIComponent(doc.id as string)}&kbId=${encodeURIComponent(doc.knowledge_base_id as string)}`
        break
      case 'user':
        // 分享用户
        const user = data as User
        title = `用户：${user.username}`
        query = `userId=${encodeURIComponent(user.user_id || user.id)}&username=${encodeURIComponent(user.username || '')}`
        break
      case 'kb':
        // 分享知识库
        const kb = data as KnowledgeBase
        title = `知识库：${kb.name}`
        query = `kbId=${encodeURIComponent(kb.id as string)}`
        break
    }
  }

  return {
    title,
    query,
    imageUrl
  }
}
