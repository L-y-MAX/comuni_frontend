<template>
  <view class="follow-page">
    <!-- Tab切换栏 -->
    <view class="tab-bar">
      <view
        class="tab-item"
        :class="{ active: activeTab === 'following' }"
        @click="switchTab('following')"
      >
        <text class="tab-text">我的关注</text>
        <view
          class="tab-badge"
          v-if="followingCount > 0"
        >
          {{ followingCount }}
        </view>
      </view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'follower' }"
        @click="switchTab('follower')"
      >
        <text class="tab-text">我的粉丝</text>
        <view
          class="tab-badge"
          v-if="followerCount > 0"
        >
          {{ followerCount }}
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view
      class="loading-container"
      v-if="isLoading"
    >
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view
      class="empty-container"
      v-else-if="listData.length === 0"
    >
      <text class="empty-text">
        {{ activeTab === 'following' ? '暂无关注的用户' : '暂无粉丝' }}
      </text>
    </view>

    <!-- 列表内容 -->
    <scroll-view
      class="list-container"
      scroll-y
      @scrolltolower="loadMore"
    >
      <view
        class="user-item"
        v-for="(item, index) in listData"
        :key="index"
        @click="gotoUserDetail(item)"
      >
        <!-- 用户头像+信息 -->
        <view class="user-info">
          <!-- 头像显示逻辑：有头像显示图片，无头像显示文字头像 -->
          <view class="avatar-container">
            <image
              class="user-avatar"
              :src="item.avatar && item.avatar !== '' ? item.avatar : ''"
              mode="aspectFill"
              v-if="item.avatar && item.avatar !== ''"
            ></image>
            <view
              class="avatar-text"
              v-else
              :style="{ backgroundColor: getAvatarColor(item) }"
            >
              {{ getAvatarText(item) }}
            </view>
          </view>
          <view class="user-detail">
            <text class="user-name">{{ item.username }}</text>
            <text class="user-desc">{{ item.bio || '暂无简介' }}</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="action-btn">
          <button
            class="btn-cancel"
            v-if="activeTab === 'following'"
            @click.stop="handleCancelFollow(item.user_id)"
          >
            取消关注
          </button>
          <button
            class="btn-remove"
            v-if="activeTab === 'follower'"
            @click.stop="handleRemoveFollower(item.user_id)"
          >
            移除粉丝
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { ref } from 'vue'
// 状态管理
const activeTab = ref<'following' | 'follower'>('following') // 当前激活的tab
const isLoading = ref(true) // 加载状态
const listData = ref<any[]>([]) // 列表数据
const followingCount = ref(0) // 关注数
const followerCount = ref(0) // 粉丝数
const page = ref(1) // 分页页码
const hasMore = ref(true) // 是否有更多数据

// 后端API基础地址
const BASE_URL = 'http://localhost:8000/api/v1/auth/user/follow'
// 获取本地Token
const getToken = () => uni.getStorageSync('accessToken') || ''

// ========== 头像相关逻辑（和user-detail页面保持一致） ==========
// 生成头像背景色（基于用户名哈希）
const getAvatarColor = (item: any) => {
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
const getAvatarText = (item: any) => {
  const username = item.username
  return username ? username.substring(0, 1).toUpperCase() : '?'
}

// ========== Tab切换逻辑 ==========
const switchTab = (tab: 'following' | 'follower') => {
  activeTab.value = tab
  page.value = 1
  hasMore.value = true
  listData.value = []
  fetchList()
}

// ========== 跳转用户详情页逻辑 ==========
const gotoUserDetail = (item: any) => {
  if (!item.user_id) {
    uni.showToast({ title: '用户ID不存在', icon: 'none' })
    return
  }
  // 跳转到用户详情页，参数编码避免特殊字符问题
  uni.navigateTo({
    url: `/pagesMember/user-detail/user-detail?userId=${encodeURIComponent(item.user_id)}&username=${encodeURIComponent(item.username || '')}`,
    fail: (err) => {
      console.error('跳转用户详情页失败:', err)
      uni.showToast({ title: '跳转失败，请重试', icon: 'none' })
    },
  })
}

// ========== API请求函数 ==========
/**
 * 获取列表数据（关注/粉丝）
 */
const fetchList = async () => {
  if (!getToken()) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.navigateBack()
    return
  }

  isLoading.value = true
  try {
    // 拼接请求URL
    const url = `${BASE_URL}/${activeTab.value}-list/`
    const response = await uni.request({
      url,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${getToken()}`, // JWT认证
      },
      data: {
        page: page.value,
        size: 10, // 每页10条
      },
    })

    const res = Array.isArray(response) ? response[1] : response
    if (res.statusCode !== 200) {
      throw new Error(`请求失败：${res.statusCode}`)
    }

    const data = res.data
    if (data.code === 200) {
      // 更新列表数据
      if (page.value === 1) {
        listData.value = data.data.list || []
      } else {
        listData.value = [...listData.value, ...(data.data.list || [])]
      }
      // 更新数量
      if (activeTab.value === 'following') {
        followingCount.value = data.data.count || 0
      } else {
        followerCount.value = data.data.count || 0
      }
      // 判断是否有更多数据
      hasMore.value = (data.data.list || []).length >= 10
    } else {
      throw new Error(data.msg || '获取数据失败')
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '加载失败'
    uni.showToast({ title: errorMsg, icon: 'none', duration: 2000 })
    console.error(`获取${activeTab.value}列表失败：`, err)
  } finally {
    isLoading.value = false
    uni.stopPullDownRefresh() // 停止下拉刷新
  }
}

/**
 * 取消关注
 * @param followedUserId 被关注用户的user_id
 */
const handleCancelFollow = async (followedUserId: string) => {
  uni.showModal({
    title: '确认取消',
    content: '是否确定取消关注该用户？',
    async success(res) {
      if (res.confirm) {
        try {
          const response = await uni.request({
            url: `${BASE_URL}/unfollow-user/`,
            method: 'DELETE',
            header: {
              'Content-Type': 'application/json',
              Authorization: `JWT ${getToken()}`,
            },
            data: { followed_user_id: followedUserId },
          })

          const res = Array.isArray(response) ? response[1] : response
          if (res.statusCode === 200 && res.data.code === 200) {
            uni.showToast({ title: '取消关注成功', icon: 'success' })
            // 重新加载列表
            page.value = 1
            fetchList()
          } else {
            throw new Error(res.data.msg || '取消关注失败')
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '操作失败'
          uni.showToast({ title: errorMsg, icon: 'none' })
          console.error('取消关注失败：', err)
        }
      }
    },
  })
}

/**
 * 移除粉丝（取消他人关注我）
 * @param followerUserId 粉丝的user_id
 */
const handleRemoveFollower = async (followerUserId: string) => {
  uni.showModal({
    title: '确认移除',
    content: '是否确定移除该粉丝？',
    async success(res) {
      if (res.confirm) {
        try {
          // 注：后端需新增移除粉丝接口，此处先复用逻辑（删除followed=当前用户、follower=粉丝的关系）
          // 若后端未实现，需先在Django的FollowViewSet中添加remove_follower接口
          const response = await uni.request({
            url: `${BASE_URL}/remove-follower/`, // 需后端配合实现
            method: 'DELETE',
            header: {
              'Content-Type': 'application/json',
              Authorization: `JWT ${getToken()}`,
            },
            data: { follower_user_id: followerUserId },
          })

          const res = Array.isArray(response) ? response[1] : response
          if (res.statusCode === 200 && res.data.code === 200) {
            uni.showToast({ title: '移除粉丝成功', icon: 'success' })
            // 重新加载列表
            page.value = 1
            fetchList()
          } else {
            throw new Error(res.data.msg || '移除粉丝失败')
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '操作失败'
          uni.showToast({ title: errorMsg, icon: 'none' })
          console.error('移除粉丝失败：', err)
        }
      }
    },
  })
}

/**
 * 加载更多
 */
const loadMore = () => {
  if (isLoading.value || !hasMore.value) return
  page.value += 1
  fetchList()
}

// ========== 页面生命周期 ==========
onLoad(() => {
  fetchList() // 页面加载时获取数据
})

onShow(() => {
  // 页面重新显示时刷新数据（比如从其他页面返回）
  page.value = 1
  fetchList()
})

onPullDownRefresh(() => {
  // 下拉刷新
  page.value = 1
  fetchList()
})
</script>

<style scoped lang="scss">
.follow-page {
  min-height: 100vh;
  background-color: #f8f9fa;
}

// Tab切换栏样式
.tab-bar {
  display: flex;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 30rpx 0;
  position: relative;

  &.active {
    .tab-text {
      color: #3b82f6;
      font-weight: 600;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60rpx;
      height: 4rpx;
      background-color: #3b82f6;
      border-radius: 2rpx;
    }
  }
}

.tab-text {
  font-size: 32rpx;
  color: #666;
}

.tab-badge {
  display: inline-block;
  min-width: 24rpx;
  height: 24rpx;
  line-height: 24rpx;
  text-align: center;
  background-color: #3b82f6;
  color: #fff;
  font-size: 20rpx;
  border-radius: 12rpx;
  margin-left: 8rpx;
}

// 加载状态
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;

  .loading-text {
    font-size: 28rpx;
    color: #999;
  }
}

// 空状态
.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;

  .empty-text {
    font-size: 28rpx;
    color: #999;
  }
}

// 列表容器
.list-container {
  height: calc(100vh - 120rpx);

  .user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx;
    background-color: #fff;
    margin-bottom: 10rpx;

    .user-info {
      display: flex;
      align-items: center;

      // 头像容器样式：统一尺寸和圆角
      .avatar-container {
        width: 80rpx;
        height: 80rpx;
        border-radius: 50%;
        overflow: hidden;
        background-color: #f0f0f0;
        margin-right: 20rpx;
        position: relative;

        .user-avatar {
          width: 100%;
          height: 100%;
        }

        // 头像文字样式：居中显示（和user-detail保持一致）
        .avatar-text {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 32rpx;
          color: #fff; // 修改为白色，匹配user-detail样式
          font-weight: 600; // 加粗文字
        }
      }

      .user-detail {
        .user-name {
          display: block;
          font-size: 32rpx;
          color: #333;
          margin-bottom: 8rpx;
        }

        .user-desc {
          font-size: 24rpx;
          color: #999;
        }
      }
    }

    .action-btn {
      .btn-cancel,
      .btn-remove {
        padding: 12rpx 24rpx;
        font-size: 26rpx;
        border-radius: 40rpx;
        border: none;
      }

      .btn-cancel {
        background-color: #eee;
        color: #666;
      }

      .btn-remove {
        background-color: #ef4444;
        color: #fff;
      }
    }
  }
}
</style>
