<template>
  <view class="page">
    <view class="sheet">
      <view class="row">
        <text class="label">名称</text>
        <input
          v-model="formData.name"
          class="field"
          placeholder="例如：春招面试笔记"
          placeholder-style="color:#b6bac1"
          :maxlength="20"
          @input="nameTouched = true"
        />
      </view>

      <view
        v-if="showNameError"
        class="error-line"
      >
        {{ nameError }}
      </view>

      <view class="row row--top">
        <text class="label">说明</text>
        <view class="field-wrap">
          <textarea
            v-model="formData.description"
            class="field field--area"
            placeholder="选填，一句话说明这个库放什么"
            placeholder-style="color:#b6bac1"
            :maxlength="200"
            :auto-height="true"
            :show-confirm-bar="false"
          />
          <text class="counter">{{ formData.description.length }}/200</text>
        </view>
      </view>

      <view class="row">
        <text class="label">可见范围</text>
        <view class="choices">
          <view
            class="choice"
            @click="formData.is_public_str = 'false'"
          >
            <view
              class="dot"
              :class="{ on: formData.is_public_str === 'false' }"
            />
            <text class="choice-text">仅自己</text>
          </view>
          <view
            class="choice"
            @click="formData.is_public_str = 'true'"
          >
            <view
              class="dot"
              :class="{ on: formData.is_public_str === 'true' }"
            />
            <text class="choice-text">所有人</text>
          </view>
        </view>
      </view>
    </view>

    <text class="footnote">选「所有人」后，其他同学可以在搜索里找到并查看这个知识库。</text>

    <view class="footer">
      <button
        class="primary-btn"
        :disabled="submitting"
        @click="submit"
      >
        {{ submitting ? '创建中…' : '创建' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { addKnowledgeBase } from '@/api/knowledge'

const formData = reactive({
  name: '',
  description: '',
  is_public_str: 'false',
})

const is_public = computed(() => formData.is_public_str === 'true')
const nameTouched = ref(false)
const submitting = ref(false)

const nameError = computed(() => {
  const v = formData.name.trim()
  if (!v) return '名称不能为空'
  if (v.length < 2) return '名称至少 2 个字'
  if (v.length > 20) return '名称最多 20 个字'
  return ''
})

const showNameError = computed(() => nameTouched.value && nameError.value !== '')

const submit = async () => {
  nameTouched.value = true
  if (nameError.value) {
    uni.showToast({ title: nameError.value, icon: 'none' })
    return
  }
  if (submitting.value) return
  submitting.value = true

  try {
    const created = await addKnowledgeBase({
      name: formData.name.trim(),
      description: formData.description?.trim() || '',
      is_public: is_public.value,
    })

    const newId = (created as any)?.id
    uni.showToast({ title: '已创建', icon: 'success' })
    setTimeout(() => {
      if (newId) {
        // 资料库现在是 tabBar 页面，switchTab 不能带 query，
        // 用本地缓存把“新建后要选中的知识库”传给资料库页。
        uni.setStorageSync('knowledgePendingTab', 'right')
        uni.setStorageSync('knowledgePendingKb', String(newId))
        uni.switchTab({
          url: '/pages/knowledge/knowledge',
          fail: () => uni.navigateBack({ delta: 1 }),
        })
      } else {
        uni.navigateBack({ delta: 1 })
      }
    }, 700)
  } catch (error) {
    console.error('创建知识库失败：', error)
    uni.showToast({ title: '创建失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background-color: #f6f7f9;
  padding: 24rpx 24rpx calc(160rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.sheet {
  background-color: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  min-height: 112rpx;
  padding: 0 28rpx;
}

.row + .row {
  border-top: 1rpx solid #f2f3f5;
}

.row--top {
  align-items: flex-start;
  padding-top: 30rpx;
  padding-bottom: 24rpx;
}

.label {
  flex: none;
  width: 150rpx;
  font-size: 30rpx;
  color: #17191c;
}

.field {
  flex: 1;
  min-width: 0;
  height: 112rpx;
  font-size: 30rpx;
  color: #17191c;
}

.field-wrap {
  flex: 1;
  min-width: 0;
}

.field--area {
  width: 100%;
  height: auto;
  min-height: 108rpx;
  padding: 16rpx 0 24rpx;
  line-height: 1.6;
}

.counter {
  display: block;
  text-align: right;
  font-size: 24rpx;
  color: #9aa0a8;
  line-height: 1;
}

.choices {
  flex: 1;
  display: flex;
  align-items: center;
}

.choice {
  display: flex;
  align-items: center;
  margin-right: 48rpx;
  -webkit-tap-highlight-color: transparent;
}

.dot {
  width: 30rpx;
  height: 30rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  border: 2rpx solid #d5d8de;
  box-sizing: border-box;
}

.dot.on {
  border-color: #ff6a33;
  border-width: 8rpx;
}

.choice-text {
  font-size: 30rpx;
  color: #17191c;
}

.error-line {
  padding: 0 28rpx 14rpx;
  font-size: 24rpx;
  color: #e5484d;
  text-align: right;
}

.footnote {
  display: block;
  padding: 20rpx 8rpx 0;
  font-size: 24rpx;
  color: #9aa0a8;
  line-height: 1.6;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-top: 1rpx solid #ececf0;
}

.primary-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #ffffff;
  background-color: #ff6a33;
  border: none;
  border-radius: 12rpx;
}

.primary-btn:active {
  background-color: #ee5a22;
}

.primary-btn[disabled] {
  color: #9aa0a8;
  background-color: #eceef1;
}
</style>
