import { ref } from 'vue'

// 响应式数据
export const userAvatar = ref('')
export const userName = ref('我的账号')
export const userDesc = ref('点击查看个人信息')
// 会员状态响应式变量
export const isVip = ref<boolean>(false)
// 登录状态：初始值基于本地存储（页面加载时就同步真实状态）
export const isLogged = ref<boolean>(!!(uni.getStorageSync('accessToken') && uni.getStorageSync('userInfo')))
export const vipExpireDate = ref<string>('')

/**
 * 会员信息数据类型
 */
export interface VipInfo {
  isVip: boolean
  expireDate: string | null // 日期字符串或null（非会员时）
}

/**
 * 从服务器获取会员信息，API响应通用类型
 */
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message: string
}

// 业务逻辑：核心修改——同步更新isLogged + 解析JSON字符串
export const getUserInfo = () => {
  const userInfo = uni.getStorageSync('userInfo')
  const accessToken = uni.getStorageSync('accessToken')

  // 核心：根据「有效凭证」更新登录状态（必须同时有token和userInfo才视为已登录）
  isLogged.value = !!accessToken && !!userInfo

  if (userInfo) {
    userName.value = userInfo.username || '我的账号'
    userAvatar.value = userInfo.avatar
    userDesc.value = userInfo.userId || '点击登录'
  } else {
    // 未登录时重置基础信息
    userName.value = '我的账号'
    userAvatar.value = 'https://youupro.xyz/notes/static/my-avatar/my-avatar.png'
    userDesc.value = '点击查看个人信息'
  }
}

/**
 * 从云端获取会员信息并更新状态
 */
export const fetchVipInfoFromServer = async () => {
  try {
    // 从本地存储获取用户信息和token（双重校验）
    const userInfo = uni.getStorageSync('userInfo')
    const accessToken = uni.getStorageSync('accessToken')

    // 同步更新登录状态（防止凭证丢失但isLogged仍为true）
    isLogged.value = !!accessToken && !!userInfo

    if (!isLogged.value) {
      console.warn('未登录，无法获取会员信息')
      uni.navigateTo({ url: '/pagesMember/login/login' })
      return
    }

    const res = await uni.request({
      url: 'https://youupro.xyz/api/v1/auth/user/vip/',
      method: 'GET',
      // 开启 withCredentials，让请求自动携带 Cookie（适配 Session 认证）
      withCredentials: true,
      // 后端要求 CSRF 校验，需添加 X-CSRFToken 头（根据实际情况）
      header: {
        'Authorization': `JWT ${accessToken}`
      },
    })

    const responseData = res.data as ApiResponse

    if (res.statusCode === 200 && responseData.success) {
      const vipData = responseData.data
      uni.setStorageSync('vipInfo', vipData)
      checkVipStatus()
    } else if (res.statusCode === 401) {
      // Token 无效/过期处理
      console.error('Token 已过期或无效，请重新登录')
      // Token失效时强制更新登录状态并清除凭证
      logout() // 传入参数：强制退出，不弹确认框
    } else {
      console.error('获取会员信息失败：', responseData.message || '未知错误')
    }
  } catch (err) {
    console.error('服务器请求失败：', err)
  }
}

// 登录相关方法：点击用户卡片时同步登录状态
export const handleUserCardClick = () => {
  // 先同步最新的登录状态
  getUserInfo()

  if (!isLogged.value) {
    // 未登录，跳转到登录页面
    uni.navigateTo({
      url: '/pagesMember/login/login',
    })
  } else {
    // 已登录，跳转到个人资料页面
    handleFeatureClick('profile')
  }
}

/**
 * 检查会员状态（从本地存储）
 */
export const checkVipStatus = () => {
  const vipInfo = uni.getStorageSync('vipInfo') as VipInfo | null
  if (vipInfo) {
    if (vipInfo.isVip && vipInfo.expireDate) {
      const now = new Date().getTime()
      const expire = new Date(vipInfo.expireDate).getTime()

      // 验证会员有效期
      if (expire > now) {
        isVip.value = true
        vipExpireDate.value = formatDate(vipInfo.expireDate)
      } else {
        isVip.value = false
        uni.removeStorageSync('vipInfo') // 清除过期数据
      }
    } else {
      isVip.value = false
    }
  } else {
    isVip.value = false
  }
}

/**
 * 格式化日期显示（YYYY-MM-DD）
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 功能点击处理
export const handleFeatureClick = (type: string) => {
  switch (type) {
    case 'profile':
      uni.navigateTo({ url: '/pagesMember/profile/profile' })
      break
  }
}

// 会员功能处理
export const handleVipFeature = () => {
  if (isVip.value) {
    // 已开通会员，跳转到会员中心
    uni.navigateTo({ url: '/pagesMember/vipInfo/vipInfo' })
  } else {
    // 未开通会员，跳转到开通页面
    handleOpenVip()
  }
}

// 开通会员
export const handleOpenVip = () => {
  uni.navigateTo({ url: '/pagesMember/vip-open/vip-open' })
}

/**
 * 退出登录
 */
export const logout = () => {
  // 退出：弹确认框
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        clearLoginState()
      }
    },
  })
}

/**
 * 清除登录状态并重置所有响应式数据（抽离为独立函数，便于复用）
 */
const clearLoginState = () => {
  // 1. 精准清除登录相关数据
  const removeKeys = [
    'accessToken',    // 用户登录令牌
    'refreshToken',   // 刷新令牌
    'userInfo',       // 用户信息对象
    'vipInfo',        // vip 判断
  ]
  removeKeys.forEach(key => {
    uni.removeStorageSync(key)
  })

  // 2. 重置响应式数据
  userName.value = '我的账号'
  userAvatar.value = 'https://youupro.xyz/notes/static/my-avatar/my-avatar.png'
  userDesc.value = '点击查看个人信息'
  isVip.value = false
  isLogged.value = false

  // 3. 跳转回我的页面
  uni.switchTab({ url: '/pages/my/my' })
}

/**
 * 新增：登录成功后同步状态的方法（供login.vue调用）
 * 登录页登录成功后，调用此方法更新我的页面的状态
 */
export const syncLoginState = () => {
  // 重新获取用户信息，自动更新isLogged、userName等
  getUserInfo()
  // 同步会员状态
  fetchVipInfoFromServer()
}

// ========== 新增：控制单个item的点击激活状态 ==========
export const activeItemId = ref('')
/** 设置当前激活的item */
export const setActiveItem = (id: string) => {
  activeItemId.value = id
}

/** 清除激活状态（延迟执行保证动画完成） */
export const clearActiveItem = () => {
  setTimeout(() => {
    activeItemId.value = ''
  }, 500) // 与CSS中transition的时长保持一致
}

// ========== 头像相关逻辑（和user-detail页面保持一致） ==========
// 生成头像背景色（基于用户名哈希）
export const getAvatarColor = () => {
  const username = userName.value || 'default'
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  // 生成 pastel 风格颜色
  const color = `hsl(${hash % 360}, 70%, 80%)`
  return color
}

// 获取头像显示文字
export const getAvatarText = () => {
  const username = userName.value
  return username ? username.substring(0, 1).toUpperCase() : '?'
}

// ========== 新增：跳转到关注/粉丝分包页面 ==========
/**
 * 跳转到关注/粉丝分包页面
 */
export const navigateToFollowPage = () => {
  // 校验登录状态
  if (!isLogged.value) {
    uni.showToast({
      title: '请先登录',
      icon: 'none',
      duration: 2000,
    })
    return
  }

  uni.navigateTo({
    url: '/pagesMember/follow/follow', // 对应分包页面路径 src\pagesMember\follow\follow.vue
    fail: (err) => {
      console.error('跳转关注页面失败：', err)
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none',
        duration: 2000,
      })
    },
  })
}

// ========== 新增：复制联系邮箱到剪贴板 ==========
/**
 * 复制联系邮箱到用户剪贴板
 */
export const copyContactEmail = () => {
  const contactEmail = 'skixkk7@163.com'
  uni.setClipboardData({
    data: contactEmail,
    success: () => {
      uni.showToast({
        title: '邮箱: skixkk7@163.com',
        icon: 'none',
        duration: 4000,
      })
    },
    fail: (err) => {
      uni.showToast({
        title: '邮箱: skixkk7@163.com',
        icon: 'none',
        duration: 4000,
      })
      console.error('复制失败, 联系我们，邮箱: skixkk7@163.com', err)
    },
  })
}

// ========== 拆分登录按钮的交互逻辑 ==========
/**
 * 微信一键登录（复用login.vue的核心逻辑）
 */
export const wxQuickLogin = async () => {
  const isLoading = ref(false)
  const REQUEST_TIMEOUT = 10000

  try {
    isLoading.value = true
    // 1. 获取微信code
    const loginRes = await uni.login({
      provider: 'weixin',
      timeout: REQUEST_TIMEOUT,
      withCredentials: true,
    })

    if (!loginRes || loginRes.errMsg !== 'login:ok' || !loginRes.code) {
      const errMsg = loginRes?.errMsg || '未知错误'
      throw new Error(`获取微信登录凭证失败：${errMsg}`)
    }

    // 2. 调用后端微信登录接口
    const response = await uni.request({
      url: 'https://youupro.xyz/api/v1/auth/wechat/mini/login/',
      method: 'POST',
      timeout: REQUEST_TIMEOUT,
      header: {
        'Content-Type': 'application/json',
      },
      data: {
        code: loginRes.code,
      },
    })

    const res = Array.isArray(response) ? response[1] : response
    if (res.statusCode !== 200) {
      throw new Error(
        `接口请求失败：${res.statusCode} - ${JSON.stringify(res.data || '无错误信息')}`,
      )
    }

    const wxData = res.data
    if (wxData.code !== 200) {
      throw new Error(wxData.msg || '微信登录失败，请重试')
    }

    // 3. 存储Token和用户信息
    uni.setStorageSync('accessToken', wxData.data.access)
    uni.setStorageSync('refreshToken', wxData.data.refresh)
    uni.setStorageSync('userOpenId', wxData.data.openid)
    uni.setStorageSync('userInfo', wxData.data.userInfo)

    // 登录成功提示 + 刷新页面
    uni.showToast({ title: '微信登录成功', icon: 'success', duration: 1500 })
    setTimeout(() => {
      getUserInfo() // 刷新用户信息
      checkVipStatus() // 刷新会员状态
    }, 1500)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '微信登录失败，请重试'
    uni.showToast({ title: errorMsg, icon: 'none', duration: 2000 })
    console.error('微信一键登录失败：', err)
  }
}

/**
 * 跳转账号密码登录页面
 */
export const navigateToLoginPage = () => {
  uni.navigateTo({
    url: '/pagesMember/login/login',
  })
}

// ========== 新增：跳转到招聘信息列表页面（无校验） ==========
/**
 * 跳转到招聘信息列表页面（无需登录/会员校验）
 */
export const navigateToRecruitmentList = () => {
  uni.navigateTo({
    url: '/pagesMember/recruitment/recruitment-list',
    fail: (err) => {
      console.error('跳转招聘信息页面失败：', err)
      uni.showToast({
        title: '页面跳转失败',
        icon: 'none',
        duration: 2000,
      })
    },
  })
}
