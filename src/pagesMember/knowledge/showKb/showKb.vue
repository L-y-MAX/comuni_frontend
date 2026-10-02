<template>
  <view class="show-kb-page">
    <!-- 加载状态 -->
    <view
      v-if="loading"
      class="loading"
    >
      <text class="loading-text">加载知识库内容中</text>
      <view class="loading-dots">
        <view class="dot"></view>
        <view class="dot"></view>
        <view class="dot"></view>
      </view>
    </view>

    <!-- 错误提示 -->
    <view
      v-else-if="error"
      class="error"
    >
      <image
        class="error-icon"
        src="https://youupro.xyz/notes/static/icons/error.png"
        mode="widthFix"
      ></image>
      <text class="error-text">{{ error }}</text>
      <button
        class="retry-btn"
        @click="fetchKbNodes"
      >
        重新加载
      </button>
    </view>

    <!-- 知识库节点列表 -->
    <view
      v-else
      class="kb-container"
    >
      <!-- 知识库标题栏 -->
      <view class="kb-header">
        <text class="kb-title">{{ kbName || '知识库内容' }}</text>
        <text class="node-count">{{ nodeList.length }} 个文档</text>
      </view>

      <!-- 节点列表为空 -->
      <view
        v-if="nodeList.length === 0"
        class="empty-nodes"
      >
        <image
          class="empty-icon"
          src="https://youupro.xyz/notes/static/icons/folder.png"
          mode="widthFix"
        ></image>
        <text class="empty-text">该知识库暂无文档内容</text>
      </view>

      <!-- 节点列表 -->
      <scroll-view
        v-else
        class="node-list-scroll"
        scroll-y
      >
        <view class="node-list">
          <view
            class="node-item"
            v-for="node in nodeList"
            :key="node.id"
            @click="gotoNodeDetail(node)"
          >
            <!-- 节点类型图标 -->
            <view class="node-type-icon">
              <image
                :src="
                  node.node_type === 'markdown'
                    ? 'https://youupro.xyz/notes/static/icons/markdown.png'
                    : 'https://youupro.xyz/notes/static/icons/folder.png'
                "
                mode="widthFix"
                class="type-icon-img"
              ></image>
            </view>
            <!-- 节点信息 -->
            <view class="node-info">
              <text class="node-name">{{ node.name || '未命名文档' }}</text>
              <text class="node-desc">{{ node.description || '' }}</text>
              <view class="node-meta">
                <text class="creator">{{ node.creator_username }}</text>
                <text class="create-time">{{ formatTime(node.created_at) }}</text>
              </view>
            </view>
            <!-- 箭头 -->
            <view class="arrow-icon">
              <image
                src="https://youupro.xyz/notes/static/icons/forward.png"
                mode="widthFix"
                class="forward-icon-img"
              ></image>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { baseURL } from '@/utils/request'

// 定义知识库节点类型接口（匹配后端返回字段）
interface KnowledgeNode {
  id: string
  short_id: string
  name: string
  knowledge_base: string
  knowledge_base_id: string
  knowledge_base_name: string
  parent_node: string | null
  parent_node_id: string | null
  parent_node_name: string | null
  node_type: string
  node_type_display: string
  editor_mode: string
  editor_mode_display: string
  content: string
  description: string
  path: string
  sort_order: number
  tags: any[]
  creator: string
  creator_id: string
  creator_username: string
  created_at: string
  updated_at: string
}

// 响应式数据
const loading = ref(true)
const error = ref('')
const kbId = ref('')
const kbName = ref('')
const nodeList = ref<KnowledgeNode[]>([])

// 页面参数接收
onLoad((options: any) => {
  // 获取从用户主页传递的知识库ID
  const knowledgeBaseId = options.knowledge_base_id || ''
  if (!knowledgeBaseId) {
    error.value = '知识库ID参数缺失'
    loading.value = false
    return
  }
  kbId.value = knowledgeBaseId
  // 加载知识库节点列表
  fetchKbNodes()
})

// 抽离请求头配置
const getHeaders = () => ({
  Authorization: `JWT ${uni.getStorageSync('accessToken') || ''}`,
  'Content-Type': 'application/json',
})

// 获取知识库节点列表
const fetchKbNodes = async () => {
  if (!kbId.value) return

  loading.value = true
  error.value = ''

  try {
    const url = `${baseURL}/api/v1/knowledge/nodes/?knowledge_base_id=${encodeURIComponent(kbId.value)}`

    const res = await uni.request({
      url,
      method: 'GET',
      header: getHeaders(),
    })

    if (res.statusCode !== 200) {
      throw new Error(`请求失败：${res.statusCode} - ${JSON.stringify(res.data)}`)
    }

    const data = res.data as any
    if (data.results && Array.isArray(data.results)) {
      nodeList.value = data.results as KnowledgeNode[]
      // 获取知识库名称（取第一个节点的知识库名称）
      if (nodeList.value.length > 0) {
        kbName.value = nodeList.value[0].knowledge_base_name || ''
      }
    } else {
      nodeList.value = []
    }
  } catch (err: any) {
    console.error('加载知识库节点失败:', err)
    error.value = err.message || '加载知识库内容失败，请重试'
  } finally {
    loading.value = false
  }
}

// 跳转到节点详情页
const gotoNodeDetail = (node: KnowledgeNode) => {
  uni.navigateTo({
    url: `/pagesMember/knowledge/showNode/showNode?id=${node.id}&kbId=${kbId.value}`,
    fail: (err) => {
      console.error('跳转文档详情失败:', err)
      uni.showToast({ title: '跳转失败，请重试', icon: 'none' })
    },
  })
}

// 时间格式化
const formatTime = (timeStr: string) => {
  if (!timeStr) return ''
  try {
    const date = new Date(timeStr)
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch (e) {
    return timeStr.slice(0, 10)
  }
}

// 下拉刷新：重新拉取该知识库下的文档列表
onPullDownRefresh(async () => {
  try {
    await fetchKbNodes()
  } finally {
    uni.stopPullDownRefresh()
  }
})

</script>

<style scoped lang="scss">
page {
  height: 100%;
  background-color: #f5f5f5;
  box-sizing: border-box;
}

.show-kb-page {
  height: 100%;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

// 加载状态样式
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;

  .loading-text {
    font-size: 28rpx;
    margin-bottom: 20rpx;
  }

  .loading-dots {
    display: flex;
    gap: 10rpx;
  }

  .dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    background-color: #666;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .dot:nth-child(1) {
    animation-delay: -0.32s;
  }

  .dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
}

// 错误提示样式
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 30rpx;
  text-align: center;

  .error-icon {
    width: 60rpx;
    height: auto;
    margin-bottom: 20rpx;
  }

  .error-text {
    font-size: 28rpx;
    color: #e53935;
    margin-bottom: 30rpx;
    line-height: 1.5;
  }

  .retry-btn {
    padding: 12rpx 40rpx;
    background-color: #007aff;
    color: #fff;
    border-radius: 20rpx;
    font-size: 26rpx;
    border: none;
  }
}

// 知识库容器样式
.kb-container {
  height: 100%;
  display: flex;
  flex-direction: column;

  // 知识库标题栏
  .kb-header {
    padding: 20rpx 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
    background-color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .kb-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }

    .node-count {
      font-size: 24rpx;
      color: #999;
    }
  }

  // 空节点状态
  .empty-nodes {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 50rpx;

    .empty-icon {
      width: 80rpx;
      height: auto;
      margin-bottom: 20rpx;
      color: #ddd;
    }

    .empty-text {
      font-size: 28rpx;
      color: #999;
    }
  }

  // 节点列表滚动容器
  .node-list-scroll {
    flex: 1;
    background-color: #f5f5f5;

    // 节点列表
    .node-list {
      padding: 15rpx;
      display: flex;
      flex-direction: column;
      gap: 10rpx;
    }

    // 节点项
    .node-item {
      background-color: #fff;
      border-radius: 16rpx;
      padding: 20rpx;
      display: flex;
      align-items: center;
      gap: 15rpx;
      box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
      transition: background-color 0.2s;

      &:active {
        background-color: #f9f9f9;
      }

      // 节点类型图标
      .node-type-icon {
        width: 60rpx;
        height: 60rpx;
        border-radius: 12rpx;
        background-color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;

        // 节点类型图片样式
        .type-icon-img {
          width: 45rpx;
          height: auto;
        }
      }

      // 节点信息
      .node-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8rpx;

        .node-name {
          font-size: 28rpx;
          font-weight: 500;
          color: #333;
          line-height: 1.4;
        }

        .node-desc {
          font-size: 24rpx;
          color: #999;
          line-height: 1.4;
          display: -webkit-box;
          line-clamp: 1;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .node-meta {
          display: flex;
          justify-content: space-between;
          margin-top: 5rpx;

          .creator {
            font-size: 22rpx;
            color: #666;
          }

          .create-time {
            font-size: 22rpx;
            color: #999;
          }
        }
      }

      // 箭头图标
      .arrow-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ddd;
        font-size: 28rpx;

        // 箭头图片样式
        .forward-icon-img {
          width: 28rpx;
          height: auto;
        }
      }
    }
  }
}
</style>
