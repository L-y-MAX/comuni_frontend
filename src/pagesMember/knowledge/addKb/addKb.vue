<template>
  <view class="add-kb-page">
    <!-- 移除自定义导航栏，使用小程序原生导航栏 -->

    <!-- 表单主体（卡片式布局） -->
    <view class="form-card">
      <uni-forms
        ref="formRef"
        :model="formData"
        class="form-content"
      >
        <!-- 知识库名称 -->
        <uni-forms-item
          label="知识库名称"
          required
          class="form-item"
        >
          <view class="input-wrapper">
            <uni-icons
              type="folder"
              size="16"
              color="#ff4500"
              class="input-icon"
            ></uni-icons>
            <input
              v-model="formData.name"
              placeholder="请输入知识库名称（必填）"
              class="form-input"
            />
          </view>
        </uni-forms-item>

        <!-- 描述 -->
        <uni-forms-item
          label="描述"
          class="form-item"
        >
          <view class="textarea-wrapper">
            <uni-icons
              type="chat"
              size="16"
              color="#ff4500"
              class="textarea-icon"
            ></uni-icons>
            <textarea
              v-model="formData.description"
              placeholder="请输入知识库描述（选填）"
              class="form-textarea"
              :maxlength="200"
            ></textarea>
            <view class="textarea-count">{{ formData.description.length }}/200</view>
          </view>
        </uni-forms-item>

        <!-- 是否公开（优化后的单选组：圆形小按钮） -->
        <uni-forms-item
          label="访问权限"
          class="form-item"
        >
          <view class="radio-wrapper">
            <radio-group
              @change="handleRadioChange"
              class="radio-group"
            >
              <!-- 公开按钮：圆形减小 -->
              <label
                class="radio-item"
                :class="{ active: formData.is_public_str === 'true' }"
              >
                <view class="radio-icon">
                  <uni-icons
                    type="checkmarkempty"
                    size="14"
                    color="#fff"
                    v-if="formData.is_public_str === 'true'"
                  ></uni-icons>
                </view>
                <span class="radio-text">公开</span>
                <radio
                  :checked="formData.is_public_str === 'true'"
                  value="true"
                  color="#ff4500"
                  class="radio-hidden"
                />
              </label>
              <!-- 私有按钮：圆形减小 -->
              <label
                class="radio-item"
                :class="{ active: formData.is_public_str === 'false' }"
              >
                <view class="radio-icon">
                  <uni-icons
                    type="checkmarkempty"
                    size="14"
                    color="#fff"
                    v-if="formData.is_public_str === 'false'"
                  ></uni-icons>
                </view>
                <span class="radio-text">私有</span>
                <radio
                  :checked="formData.is_public_str === 'false'"
                  value="false"
                  color="#ff4500"
                  class="radio-hidden"
                />
              </label>
            </radio-group>
            <view class="radio-tip">私有：仅创建者可查看；公开：所有用户可查看</view>

            <!-- 创建按钮移到权限选择下方 -->
            <button
              class="submit-btn"
              @click="submit"
              :disabled="!formData.name.trim()"
            >
              创建
            </button>
          </view>
        </uni-forms-item>
      </uni-forms>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { addKnowledgeBase } from '@/api/knowledge'

const formRef = ref<any>(null)
const formData = reactive({
  name: '',
  description: '',
  is_public_str: 'false', // 默认私有
})

// 计算属性：转换为布尔值
const is_public = computed(() => {
  return formData.is_public_str === 'true'
})

// 单选组事件
const handleRadioChange = (e: { detail: { value: string } }) => {
  formData.is_public_str = e.detail.value
}

// 创建-提交逻辑（保持原有功能）
const submit = async () => {
  if (!formData.name.trim()) {
    uni.showToast({ title: '名称不能为空', icon: 'none' })
    return
  }

  try {
    const submitData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || '',
      is_public: is_public.value,
    }
    await addKnowledgeBase(submitData)
    uni.showToast({ title: '创建成功', icon: 'success' })

    setTimeout(() => {
      uni.navigateBack({
        delta: 1,
        success: () => {
          const pages = getCurrentPages()
          if (pages.length >= 2) {
            const prevPage = pages[pages.length - 2]
            const prevVm = prevPage.$vm || prevPage
            if (prevVm && typeof prevVm.fetchKnowledgeBaseList === 'function') {
              prevVm.fetchKnowledgeBaseList()
            }
          }
        },
        fail: (err) => {
          console.error('返回失败：', err)
          uni.redirectTo({ url: '/pages/knowledge/knowledge' })
        },
      })
    }, 1000)
  } catch (error) {
    console.error('创建失败：', error)
    uni.showToast({ title: '创建失败，请重试', icon: 'none' })
  }
}
</script>

<style scoped lang="scss">
// 全局样式重置
.add-kb-page {
  min-height: 100vh;
  background-color: #f5f7fa;
}

// 移除自定义导航栏样式

// 表单卡片
.form-card {
  margin: 30rpx;
  background-color: #fff;
  border-radius: 24rpx; // 圆边优化
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.form-content {
  padding: 40rpx 30rpx;
}

// 表单项通用样式
.form-item {
  margin-bottom: 40rpx;

  // 标签样式优化
  ::v-deep(.uni-forms-item__label) {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    padding-bottom: 16rpx;
    display: block;
  }

  // 必填星号样式
  ::v-deep(.uni-forms-item__required) {
    color: #ff4500; // 主题色修改
    margin-right: 8rpx;
  }
}

// 输入框样式
.input-wrapper {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  background-color: #f8f9fa;
  border-radius: 44rpx; // 圆边（高度一半）
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;

  &:active {
    background-color: #eef1f5;
    border-color: #ff4500; // 主题色修改
  }

  .input-icon {
    margin-right: 16rpx;
  }

  .form-input {
    flex: 1;
    height: 100%;
    font-size: 32rpx;
    color: #333;
    background-color: transparent;
    border: none;
    outline: none;

    &::placeholder {
      color: #999;
      font-size: 30rpx;
    }
  }
}

// 文本域样式
.textarea-wrapper {
  position: relative;
  padding: 24rpx;
  background-color: #f8f9fa;
  border-radius: 24rpx; // 圆边优化
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;

  &:active {
    border-color: #ff4500; // 主题色修改
  }

  .textarea-icon {
    position: absolute;
    top: 24rpx;
    left: 24rpx;
    z-index: 1;
  }

  .form-textarea {
    width: 100%;
    min-height: 160rpx;
    font-size: 32rpx;
    color: #333;
    background-color: transparent;
    border: none;
    outline: none;
    padding-left: 48rpx;
    padding-bottom: 40rpx;
    box-sizing: border-box;
    resize: none;

    &::placeholder {
      color: #999;
      font-size: 30rpx;
    }
  }

  .textarea-count {
    position: absolute;
    bottom: 16rpx;
    right: 24rpx;
    font-size: 24rpx;
    color: #999;
  }
}

// 单选组样式（核心优化：圆形小按钮）
.radio-wrapper {
  width: 100%;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效

  .radio-group {
    display: flex;
    gap: 24rpx;
    margin-bottom: 20rpx;
    justify-content: flex-start;
    -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  }

  // 圆形小按钮样式
  .radio-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120rpx; // 减小宽度
    height: 60rpx; // 减小高度
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 30rpx; // 圆形（高度一半）
    -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
    transition: all 0.3s ease;
    position: relative;
    cursor: pointer;

    &.active {
      background-color: #ff4500; // 主题色修改
      border-color: #ff4500; // 主题色修改
    }

    .radio-icon {
      width: 24rpx; // 减小图标容器
      height: 24rpx; // 减小图标容器
      border-radius: 50%; // 圆形
      background-color: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 8rpx;
      transition: all 0.3s ease;

      .active & {
        background-color: #fff;
      }
    }

    .radio-text {
      font-size: 28rpx; // 减小文字
      color: #333;
      -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
      transition: all 0.3s ease;

      .active & {
        color: #fff;
      }
    }

    // 隐藏原生radio
    .radio-hidden {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      opacity: 0;
    }
  }

  .radio-tip {
    font-size: 26rpx;
    color: #999;
    padding-left: 8rpx;
    line-height: 1.4;
    margin-bottom: 30rpx; // 与创建按钮间距
  }

  // 创建按钮样式（移到权限下方后）
  .submit-btn {
    width: 100%;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #ff4500; // 主题色修改
    -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
    color: #fff;
    border-radius: 44rpx; // 圆边（高度一半）
    font-size: 32rpx;
    font-weight: 500;
    border: none;
    padding: 0;
    margin: 0;

    &:disabled {
      background-color: #ccc;
      color: #fff;
      cursor: not-allowed;
    }

    &:active:not(:disabled) {
      background-color: #e03c00; // 主题色加深
      transform: scale(0.98);
    }
  }
}
</style>
