<template>
  <view class="page">
    <view class="card">
      <view class="card-title">修改登录密码</view>

      <!-- 当前密码 -->
      <view class="field">
        <text class="label">当前密码</text>
        <view class="input-wrap" :class="{ error: errors.old }">
          <input
            class="input"
            type="text"
            :password="!show.old"
            v-model="form.old"
            placeholder="请输入当前密码"
            placeholder-class="ph"
            maxlength="128"
          />
          <view class="eye" @click.stop="toggle('old')">
            <uni-icons
              :type="show.old ? 'eye-filled' : 'eye-slash-filled'"
              size="19"
              :color="show.old ? '#ff7a45' : '#b6bcc8'"
            />
          </view>
        </view>
        <text v-if="errors.old" class="err">{{ errors.old }}</text>
      </view>

      <!-- 新密码 -->
      <view class="field">
        <text class="label">新密码</text>
        <view class="input-wrap" :class="{ error: errors.newPwd }">
          <input
            class="input"
            type="text"
            :password="!show.newPwd"
            v-model="form.newPwd"
            placeholder="至少 6 位，建议字母 + 数字"
            placeholder-class="ph"
            maxlength="128"
          />
          <view class="eye" @click.stop="toggle('newPwd')">
            <uni-icons
              :type="show.newPwd ? 'eye-filled' : 'eye-slash-filled'"
              size="19"
              :color="show.newPwd ? '#ff7a45' : '#b6bcc8'"
            />
          </view>
        </view>
        <text v-if="errors.newPwd" class="err">{{ errors.newPwd }}</text>
      </view>

      <!-- 确认新密码 -->
      <view class="field">
        <text class="label">确认新密码</text>
        <view class="input-wrap" :class="{ error: errors.confirm }">
          <input
            class="input"
            type="text"
            :password="!show.confirm"
            v-model="form.confirm"
            placeholder="请再次输入新密码"
            placeholder-class="ph"
            maxlength="128"
          />
          <view class="eye" @click.stop="toggle('confirm')">
            <uni-icons
              :type="show.confirm ? 'eye-filled' : 'eye-slash-filled'"
              size="19"
              :color="show.confirm ? '#ff7a45' : '#b6bcc8'"
            />
          </view>
        </view>
        <text v-if="errors.confirm" class="err">{{ errors.confirm }}</text>
      </view>

      <button
        class="submit"
        :class="{ disabled: !canSubmit }"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        {{ submitting ? '提交中…' : '确认修改' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { post, baseURL, logout } from '@/utils/request'

const form = reactive({
  old: '',
  newPwd: '',
  confirm: '',
})

const errors = reactive({
  old: '',
  newPwd: '',
  confirm: '',
})

const show = reactive({
  old: false,
  newPwd: false,
  confirm: false,
})

const submitting = ref(false)

const canSubmit = computed(
  () => form.old.trim().length > 0 && form.newPwd.trim().length >= 6 && form.confirm.trim().length > 0,
)

/** 切换某个密码框的可见性 */
const toggle = (key: 'old' | 'newPwd' | 'confirm') => {
  show[key] = !show[key]
}

const validate = (): boolean => {
  errors.old = form.old.trim() ? '' : '请输入当前密码'
  if (!form.newPwd.trim()) {
    errors.newPwd = '请输入新密码'
  } else if (form.newPwd.trim().length < 6) {
    errors.newPwd = '新密码至少 6 位'
  } else if (form.newPwd.trim() === form.old.trim()) {
    errors.newPwd = '新密码不能与当前密码相同'
  } else {
    errors.newPwd = ''
  }
  if (!form.confirm.trim()) {
    errors.confirm = '请再次输入新密码'
  } else if (form.confirm.trim() !== form.newPwd.trim()) {
    errors.confirm = '两次输入的新密码不一致'
  } else {
    errors.confirm = ''
  }
  return !errors.old && !errors.newPwd && !errors.confirm
}

const submit = async () => {
  if (submitting.value) return
  if (!validate()) return

  const token = uni.getStorageSync('accessToken')
  if (!token) {
    uni.showToast({ title: '登录已过期，请先登录', icon: 'none' })
    setTimeout(() => {
      uni.redirectTo({ url: '/pagesMember/login/login' })
    }, 800)
    return
  }

  submitting.value = true
  try {
    await post(`${baseURL}/api/v1/auth/password/change/`, {
      old_password: form.old.trim(),
      new_password: form.newPwd.trim(),
      confirm_password: form.confirm.trim(),
    })
    uni.showToast({ title: '密码修改成功', icon: 'success' })
    // 密码已变更：清除登录态并回到登录页，用新密码重新登录
    setTimeout(() => {
      logout()
    }, 1200)
  } catch (err) {
    // 错误提示已由请求封装统一 toast，这里只做兜底
    const msg = err instanceof Error ? err.message : '修改失败，请稍后重试'
    if (msg && msg !== 'null') {
      // 避免重复 toast：仅当封装未提示时补充
    }
  } finally {
    submitting.value = false
  }
}

onLoad(() => {
  const token = uni.getStorageSync('accessToken')
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.redirectTo({ url: '/pagesMember/login/login' })
    }, 800)
  }
})
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #f6f7fb;
  padding: 24rpx;
  box-sizing: border-box;
}

.card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx 28rpx 36rpx;
  box-shadow: 0 6rpx 24rpx rgba(31, 41, 55, 0.06);
}

.card-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
}

.field {
  margin-top: 28rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #4b5563;
  margin-bottom: 12rpx;
}

.input-wrap {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 2rpx solid #e5e7eb;
  border-radius: 14rpx;
  padding: 0 16rpx 0 20rpx;
  height: 92rpx;
  transition: border-color 0.15s;

  &.error {
    border-color: #ef4444;
  }

  &:focus-within {
    border-color: #ff7a45;
  }
}

.input {
  flex: 1;
  height: 92rpx;
  font-size: 28rpx;
  color: #1f2937;
}

.ph {
  color: #b6bcc8;
  font-size: 26rpx;
}

.eye {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 4rpx 8rpx 16rpx;
}

.err {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #ef4444;
}

.submit {
  margin-top: 40rpx;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 46rpx;
  background: linear-gradient(135deg, #ff9a6b, #ff7a45);
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;

  &::after {
    border: none;
  }

  &.disabled {
    background: #e5e7eb;
    color: #9ca3af;
  }
}

</style>
