<template>
  <view class="add-kb-page">
    <!-- 表单主体（卡片式布局） -->
    <view class="form-card">
      <uni-forms
        ref="formRef"
        :model="formData"
        class="form-content"
      >
        <!-- 知识库名称 -->
        <uni-forms-item
          label="知识库名称（必填）"
          class="form-item"
        >
          <view
            class="input-wrapper"
            :class="{ 'has-error': showNameError }"
          >
            <uni-icons
              type="folder-add"
              size="16"
              color="#ff7239"
              class="input-icon"
            ></uni-icons>
            <input
              v-model="formData.name"
              placeholder="例：春招面试笔记、计算机408考点"
              placeholder-class="input-ph"
              class="form-input"
              :maxlength="20"
              @input="onNameInput"
            />
          </view>
          <text
            v-if="showNameError"
            class="field-error"
          >
            {{ nameError }}
          </text>
          <text
            v-else
            class="field-hint"
          >
            {{ formData.name.length }}/20 字
          </text>
        </uni-forms-item>

        <!-- 描述 -->
        <uni-forms-item
          label="知识库描述（选填）"
          class="form-item"
        >
          <view class="textarea-wrapper">
            <uni-icons
              type="chat"
              size="16"
              color="#ff7239"
              class="textarea-icon"
            ></uni-icons>
            <textarea
              v-model="formData.description"
              placeholder="简单介绍这个库存放什么资料，方便同学看懂"
              placeholder-class="input-ph"
              class="form-textarea"
              :maxlength="200"
            ></textarea>
            <view class="textarea-count">{{ formData.description.length }}/200</view>
          </view>
          <text class="field-hint tip">提示：创建完成后，进入知识库可一键插入示例文章模板</text>
        </uni-forms-item>

        <!-- 访问权限：两个选项各自说明，整卡可点扩大热区 -->
        <uni-forms-item
          label="访问权限"
          class="form-item"
        >
          <view class="perm-list">
            <view
              class="perm-card"
              :class="{ active: formData.is_public_str === 'true' }"
              @click="selectPerm('true')"
            >
              <uni-icons
                type="eye"
                size="16"
                :color="formData.is_public_str === 'true' ? '#ffffff' : '#ff7239'"
                class="perm-icon"
              ></uni-icons>
              <text class="perm-name">公开</text>
            </view>
            <view
              class="perm-card"
              :class="{ active: formData.is_public_str === 'false' }"
              @click="selectPerm('false')"
            >
              <uni-icons
                type="locked"
                size="16"
                :color="formData.is_public_str === 'false' ? '#ffffff' : '#ff7239'"
                class="perm-icon"
              ></uni-icons>
              <text class="perm-name">私有</text>
            </view>
          </view>

          <!-- 创建按钮：校验不通过时置灰不可点 -->
          <button
            class="submit-btn"
            :class="{ 'is-disabled': !canSubmit }"
            :disabled="!canSubmit"
            @click="submit"
          >
            创建
          </button>
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
const is_public = computed(() => formData.is_public_str === 'true')

// ========== 名称校验：2~20 字，空名称直接提示 ==========
const nameTouched = ref(false)

const nameError = computed(() => {
  const v = formData.name.trim()
  if (!v) return '知识库名称不能为空'
  if (v.length < 2) return '名称至少 2 个字符'
  if (v.length > 20) return '名称最多 20 个字符'
  return ''
})

/** 只有用户输入过或点过创建才显示错误，避免一进页面就红字 */
const showNameError = computed(() => nameTouched.value && nameError.value !== '')

/** 校验通过才允许提交，按钮同步置灰 */
const canSubmit = computed(() => nameError.value === '')

const onNameInput = () => {
  nameTouched.value = true
}

// 权限选择（整卡点击）
const selectPerm = (v: string) => {
  formData.is_public_str = v
}

// 创建-提交逻辑
const submit = async () => {
  nameTouched.value = true
  if (!canSubmit.value) {
    uni.showToast({ title: nameError.value || '请检查填写内容', icon: 'none' })
    return
  }

  try {
    const submitData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || '',
      is_public: is_public.value,
    }
    const created = await addKnowledgeBase(submitData)
    uni.showToast({ title: '知识库创建成功', icon: 'success' })

    // 彩蛋：创建成功后直接进入该知识库的文章列表，引导「新增文章」形成闭环
    const newId = (created as any)?.id
    setTimeout(() => {
      if (newId) {
        uni.redirectTo({
          url: `/pages/knowledge/knowledge?tab=right&kbId=${encodeURIComponent(String(newId))}`,
          fail: () => {
            uni.navigateBack({ delta: 1 })
          },
        })
      } else {
        uni.navigateBack({ delta: 1 })
      }
    }, 900)
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

// 表单卡片
.form-card {
  margin: 30rpx;
  background-color: #fff;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.form-content {
  padding: 40rpx 30rpx;
}

// 表单项通用样式
.form-item {
  margin-bottom: 40rpx;

  // 标签样式
  ::v-deep(.uni-forms-item__label) {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    padding-bottom: 16rpx;
    display: block;
  }

  // 必填星号（标签文字里已写明必填，这里保留兼容）
  ::v-deep(.uni-forms-item__required) {
    color: #ff7239;
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
  border-radius: 44rpx;
  border: 1rpx solid #e9ecef;
  transition: all 0.3s ease;

  &:active {
    background-color: #eef1f5;
    border-color: #ff7239;
  }

  // 校验失败：红框
  &.has-error {
    border-color: #ef4444;
    background-color: #fff5f5;

    &:active {
      border-color: #ef4444;
    }
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
  }

  :deep(.input-ph) {
    color: #999;
    font-size: 28rpx;
  }
}

// 文本域样式
.textarea-wrapper {
  position: relative;
  padding: 24rpx;
  background-color: #f8f9fa;
  border-radius: 24rpx;
  border: 1rpx solid #e9ecef;
  transition: all 0.3s ease;

  &:active {
    border-color: #ff7239;
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
  }

  .textarea-count {
    position: absolute;
    bottom: 16rpx;
    right: 24rpx;
    font-size: 24rpx;
    color: #999;
  }
}

// 校验提示 / 辅助说明
.field-error {
  display: block;
  margin-top: 10rpx;
  padding-left: 12rpx;
  font-size: 24rpx;
  color: #ef4444;
}

.field-hint {
  display: block;
  margin-top: 10rpx;
  padding-left: 12rpx;
  font-size: 24rpx;
  color: #9ca3af;

  &.tip {
    margin-top: 14rpx;
  }
}

// 权限选项：紧凑按钮（图标 + 文字）
.perm-list {
  display: flex;
  gap: 20rpx;
  width: 100%;
}

.perm-card {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76rpx;
  padding: 0 20rpx;
  background-color: #f8f9fa;
  border: 1rpx solid #e9ecef;
  border-radius: 38rpx;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s ease;

  &:active {
    opacity: 0.85;
  }

  &.active {
    background-color: #ff7239;
    border-color: #ff7239;
  }

  .perm-icon {
    margin-right: 10rpx;
  }

  .perm-name {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
  }

  &.active .perm-name {
    color: #ffffff;
  }
}

// 创建按钮
.submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  margin-top: 30rpx;
  background-color: #ff7239;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  padding: 0;
  -webkit-tap-highlight-color: transparent;

  // 未通过校验：置灰
  &.is-disabled {
    background-color: #e5e7eb;
    color: #9ca3af;
  }

  &:disabled {
    background-color: #e5e7eb;
    color: #9ca3af;
  }

  &:active:not(:disabled):not(.is-disabled) {
    background-color: #e8571f;
    transform: scale(0.98);
  }
}
</style>
