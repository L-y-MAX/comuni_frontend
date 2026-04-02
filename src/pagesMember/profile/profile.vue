<template>
  <view class="profile-page">
    <!-- 主内容区域 -->
    <scroll-view
      class="content-scroll"
      :scroll-y="true"
    >
      <!-- 头像区域 -->
      <view class="avatar-section">
        <view class="avatar-container">
          <view
            class="avatar-wrapper"
            @click="chooseAvatar"
          >
            <!-- 头像显示逻辑：有头像显示图片，无则显示文字头像 -->
            <image
              v-if="userAvatar && userAvatar !== ''"
              :src="userAvatar"
              class="avatar-image"
              mode="aspectFill"
            />
            <view
              v-else
              class="avatar-text"
              :style="{ backgroundColor: getAvatarColor() }"
            >
              <text>{{ getAvatarText() }}</text>
            </view>
          </view>
          <view class="avatar-glow"></view>
        </view>
        <text
          class="avatar-hint clickable"
          @click="chooseAvatar"
        >
          点击更换头像
        </text>
      </view>

      <!-- 信息卡片 -->
      <view class="info-cards">
        <!-- 基本信息卡片 -->
        <view class="info-card">
          <view class="card-header">
            <text class="card-title">基本信息</text>
          </view>
          <view class="card-content">
            <view
              v-if="!isEditing"
              class="info-row"
            >
              <text class="info-label">用户名</text>
              <text class="info-value">{{ userName }}</text>
            </view>
            <view
              v-else
              class="edit-row"
            >
              <text class="info-label">用户名</text>
              <input
                v-model="editForm.username"
                class="edit-input"
                placeholder="请输入用户名"
              />
            </view>
            <view
              v-if="!isEditing"
              class="info-row"
            >
              <text class="info-label">邮箱</text>
              <text class="info-value">{{ userEmail }}</text>
            </view>
            <view
              v-else
              class="edit-row"
            >
              <text class="info-label">邮箱</text>
              <input
                v-model="editForm.email"
                class="edit-input"
                placeholder="请输入邮箱"
                type="text"
              />
            </view>
            <view
              v-if="!isEditing"
              class="info-row"
            >
              <text class="info-label">性别</text>
              <text class="info-value">{{ editForm.gender || '未设置' }}</text>
            </view>
            <view
              v-else
              class="edit-row"
            >
              <text class="info-label">性别</text>
              <picker
                mode="selector"
                :range="genderOptions"
                :value="genderIndex"
                @change="onGenderChange"
                class="edit-picker"
              >
                <view class="picker-display">{{ editForm.gender || '请选择性别' }}</view>
              </picker>
            </view>
            <view
              v-if="!isEditing"
              class="info-row"
            >
              <text class="info-label">用户ID</text>
              <text class="info-value">{{ userId }}</text>
            </view>
            <view
              v-else
              class="edit-row"
            >
              <text class="info-label">用户ID</text>
              <input
                v-model="editForm.userId"
                class="edit-input"
                placeholder="请输入用户ID"
              />
            </view>
          </view>
        </view>

        <!-- 会员信息卡片 -->
        <view class="info-card">
          <view class="card-header">
            <text class="card-title">会员信息</text>
          </view>
          <view class="card-content">
            <view class="info-row">
              <text class="info-label">会员等级</text>
              <text class="info-value">{{ memberLevel }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">注册时间</text>
              <text class="info-value">{{ formattedRegTime }}</text>
            </view>
          </view>
        </view>

        <!-- 个人简介卡片 -->
        <view class="info-card">
          <view class="card-header">
            <text class="card-title">个人简介</text>
          </view>
          <view class="card-content">
            <text
              v-if="!isEditing"
              class="bio-text"
            >
              {{ userBio }}
            </text>
            <textarea
              v-else
              v-model="editForm.bio"
              class="edit-textarea"
              placeholder="请输入个人简介"
              rows="3"
            />
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <view
          v-if="!isEditing"
          class="action-btn primary-btn effect-btn-1"
          @click="editProfile"
        >
          <text class="btn-text">编辑资料</text>
        </view>
        <view
          v-else
          class="edit-buttons"
        >
          <view
            class="action-btn save-btn effect-btn-2"
            @click="saveProfile"
          >
            <text class="btn-text">保存</text>
          </view>
          <view
            class="action-btn cancel-btn effect-btn-2"
            @click="cancelEdit"
          >
            <text class="btn-text">取消</text>
          </view>
        </view>
        <view
          class="action-btn secondary-btn effect-btn-1"
          @click="changePassword"
        >
          <text class="btn-text">修改密码</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useUserStore } from './user'
import { baseURL, post } from '../../utils/request'

// 初始化响应式变量
const userAvatar = ref('')
const userName = ref('我的账号')
const userEmail = ref('未设置')
const memberLevel = ref('普通会员')
const userBio = ref('未填写')
const userRegTime = ref('')
const userId = ref('')

// 编辑模式
const isEditing = ref(false)
const editForm = ref({
  username: '',
  email: '',
  bio: '',
  gender: '',
  is_private: false,
  userId: '',
  avatar: '',
})
const originalForm = ref({ ...editForm.value })

// 性别选择器
const genderOptions = ['男', '女', '其他']
const genderIndex = ref(0)

// ========== 头像相关逻辑（和my页面保持一致） ==========
// 生成头像背景色（基于用户名哈希）
const getAvatarColor = () => {
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
const getAvatarText = () => {
  const username = userName.value
  return username ? username.substring(0, 1).toUpperCase() : '?'
}

// 格式化注册时间
const formattedRegTime = computed(() => {
  if (!userRegTime.value) return '未知'
  try {
    const date = new Date(userRegTime.value)
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
  } catch (e) {
    return userRegTime.value
  }
})

// 核心修复：在 onMounted/onLoad 中初始化 store
const loadUserInfo = () => {
  // 确保在 Vue 实例挂载后使用 store
  const userStore = useUserStore()

  // 手动加载本地存储数据（防止 Pinia 初始化时机问题）
  userStore.loadFromStorage()

  // 赋值到页面变量
  if (userStore.userInfo) {
    userAvatar.value = userStore.userInfo.avatar || ''
    userName.value = userStore.userInfo.username || '我的账号'
    userEmail.value = userStore.userInfo.email || '未设置'
    userBio.value = userStore.userInfo.bio || '未填写'
    userRegTime.value = userStore.userInfo.created_at || ''
    userId.value = userStore.userInfo.userId || ''

    // 初始化编辑表单
    editForm.value = {
      username: userStore.userInfo.username || '',
      email: userStore.userInfo.email || '',
      bio: userStore.userInfo.bio || '',
      gender: userStore.userInfo.gender || '',
      is_private: userStore.userInfo.is_private || false,
      userId: userStore.userInfo.userId || '',
      avatar: userStore.userInfo.avatar || '',
    }
    originalForm.value = { ...editForm.value }
    genderIndex.value =
      genderOptions.indexOf(editForm.value.gender) >= 0
        ? genderOptions.indexOf(editForm.value.gender)
        : 0
  }

  // 处理会员信息
  if (userStore.vipInfo) {
    memberLevel.value = userStore.vipInfo.isVip
      ? `VIP会员 (有效期至: ${userStore.vipInfo.expireDate})`
      : '普通会员'
  }
}

// 选择头像
const chooseAvatar = () => {
  uni.chooseImage({
    count: 1, // 仅选1张
    sizeType: ['original', 'compressed'], // 原图/压缩图
    sourceType: ['album', 'camera'], // 相册/相机
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]
      uni.showLoading({ title: '上传头像中...' })

      // 上传文件到后端
      uni.uploadFile({
        // 后端头像上传接口地址
        url: `${baseURL}/api/v1/auth/user-info/upload_avatar/`,
        filePath: tempFilePath,
        name: 'avatar', // 后端接收文件的字段名
        header: {
          // 携带JWT Token认证
          Authorization: `JWT ${uni.getStorageSync('accessToken')}`,
        },
        success: (uploadRes) => {
          uni.hideLoading()
          try {
            const result = JSON.parse(uploadRes.data)
            if (result.code === 200 && result.data.avatar_url) {
              // 更新页面头像
              userAvatar.value = result.data.avatar_url
              // 更新到store
              const userStore = useUserStore()
              userStore.updateUserInfo({ avatar: result.data.avatar_url })
              uni.showToast({
                title: '头像更换成功',
                icon: 'success',
                duration: 1500,
              })
            } else {
              throw new Error(result.msg || '上传失败')
            }
          } catch (e) {
            uni.showToast({
              title: `解析失败：${(e as Error).message}`,
              icon: 'none',
              duration: 2000,
            })
          }
        },
        fail: (uploadErr) => {
          uni.hideLoading()
          console.error('头像上传失败:', uploadErr)
          uni.showToast({
            title: '头像上传失败，请重试',
            icon: 'none',
            duration: 2000,
          })
        },
      })
    },
    // 新增：用户取消选择的处理
    fail: (err) => {
      // 排除用户主动取消的情况（err.errMsg 包含 cancel）
      if (!err.errMsg.includes('cancel')) {
        console.error('选择头像失败:', err)
        // 权限不足提示
        if (err.errMsg.includes('auth')) {
          uni.showModal({
            title: '权限提示',
            content: '需要获取相册/相机权限才能更换头像，请前往设置开启',
            confirmText: '去设置',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 跳转到小程序设置页（仅小程序支持）
                uni.openSetting({
                  success: (settingRes) => {
                    console.log('设置页返回:', settingRes)
                  },
                })
              }
            },
          })
        } else {
          uni.showToast({
            title: '选择头像失败，请重试',
            icon: 'none',
            duration: 2000,
          })
        }
      }
    },
  })
}

// 页面生命周期 - 确保 Pinia 已初始化
onLoad(() => {
  console.log('个人资料页面加载')
  // 延迟执行，确保 Pinia 完全初始化
  setTimeout(() => loadUserInfo(), 0.5)
})

onMounted(() => {
  loadUserInfo() // 双重保障
})

onShow(() => {
  loadUserInfo() // 每次显示页面时刷新数据
})

// ========== 新增方法 ==========
const editProfile = () => {
  originalForm.value = { ...editForm.value }
  isEditing.value = true
}

const changePassword = () => {
  uni.navigateTo({
    url: '/pagesMember/accountSecurity/accountSecurity',
  })
}

// 保存编辑
const saveProfile = async () => {
  try {
    const data = {
      username: editForm.value.username,
      email: editForm.value.email,
      bio: editForm.value.bio,
      gender: editForm.value.gender,
      is_private: editForm.value.is_private,
      // avatar: null, // null 清空 / 删除现有头像
      user_id: editForm.value.userId,
      is_staff: false,
    }

    const result = await post('/api/v1/auth/user-info/', data)
    if (result.code === 200) {
      uni.showToast({
        title: '保存成功',
        icon: 'success',
      })
      // 更新store
      const userStore = useUserStore()
      userStore.updateUserInfo({
        ...editForm.value,
        userId: editForm.value.userId,
        avatar: result.data.avatar_url,
      })
      // 刷新页面数据
      loadUserInfo()
      isEditing.value = false
    }
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 取消编辑
const cancelEdit = () => {
  editForm.value = { ...originalForm.value }
  genderIndex.value =
    genderOptions.indexOf(editForm.value.gender) >= 0
      ? genderOptions.indexOf(editForm.value.gender)
      : 0
  isEditing.value = false
}

// 性别选择器变化
const onGenderChange = (e: any) => {
  const index = e.detail.value
  genderIndex.value = index
  editForm.value.gender = genderOptions[index]
}
</script>

<style scoped lang="scss">
// 主题变量 - 优化质感，使用渐变替代纯色
$primary-gradient: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
$secondary-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
$success-gradient: linear-gradient(135deg, #10b981 0%, #34d399 100%);
$cancel-gradient: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
$effect1-gradient: linear-gradient(to right, #0fd850 0%, #f9f047 100%);
$effect2-gradient1: linear-gradient(135deg, #240046 0%, #3c096c 100%);
$effect2-gradient2: linear-gradient(135deg, #5a189a 0%, #7b2cbf 100%);

// 浅色主题
$text-primary-light: #1f2937;
$text-secondary-light: #6b7280;
$text-tertiary-light: #9ca3af;
$bg-primary-light: #ffffff;
$bg-secondary-light: #f8fafc;
$bg-tertiary-light: #f1f5f9;
$border-light: #e5e7eb;
$card-bg-light: #ffffff;
$shadow-light: 0 4rpx 24rpx rgba(79, 70, 229, 0.08);

// 通用变量
$border-radius: 16rpx;
$border-radius-large: 24rpx;
$transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

// 个人资料页面
.profile-page {
  min-height: 100vh;
  background: linear-gradient(135deg, $bg-secondary-light 0%, $bg-tertiary-light 100%);
}

// 内容滚动区域
.content-scroll {
  padding-top: 40rpx;
  min-height: 100vh;
}

// 头像区域
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 24rpx 40rpx;
}

.avatar-container {
  position: relative;
  margin-bottom: 24rpx;
}

.avatar-wrapper {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  border: 4rpx solid rgba(79, 70, 229, 0.2);
}

.avatar-image {
  width: 100%;
  height: 100%;
}

// 文字头像样式（和my页面保持一致）
.avatar-text {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: #fff;
    font-size: 56rpx;
    font-weight: 600;
  }
}

.edit-icon {
  font-size: 24rpx;
}

.avatar-glow {
  position: absolute;
  top: -8rpx;
  left: -8rpx;
  right: -8rpx;
  bottom: -8rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
  animation: pulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.6;
  }
}

// 新增：可点击元素的通用样式
.clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  transition: $transition;

  &:active {
    opacity: 0.8;
    transform: scale(0.98);
  }
}

.avatar-hint {
  font-size: 26rpx;
  font-weight: 500;
  margin-top: 8rpx; // 新增：增加和头像的间距
  -webkit-tap-highlight-color: transparent; // 取消微信默认的点击高亮特效
  // 新增：可点击的视觉提示
  &.clickable {
    color: #4f46e5; // 主色突出
    &:hover {
      text-decoration: underline; // 鼠标悬浮下划线（H5端）
    }
  }
  color: $text-secondary-light;
  &.clickable {
    color: #4f46e5;
  }
}

// 信息卡片区域
.info-cards {
  padding: 0 24rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.info-card {
  background: $card-bg-light;
  border: 1rpx solid $border-light;
  border-radius: $border-radius-large;
  padding: 32rpx;
  box-shadow: $shadow-light;
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $border-light;
}

.card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-primary-light;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-row {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.edit-input,
.edit-textarea {
  border: 1rpx solid $border-light;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  font-size: 28rpx;
  background: $bg-secondary-light;
  color: $text-primary-light;
}

.edit-textarea {
  resize: none;
}

.picker-display {
  border: 1rpx solid $border-light;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  font-size: 28rpx;
  background: $bg-secondary-light;
  color: $text-primary-light;
}

.edit-buttons {
  display: flex;
  gap: 16rpx;
}

// 修改保存按钮默认背景为白色，适配深色模式
.save-btn {
  background: #ffffff;
  color: #10b981; // 保留原成功色作为文字色
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 1;
}

// 修改取消按钮默认背景为白色，适配深色模式
.cancel-btn {
  background: #ffffff;
  color: #6b7280; // 保留原取消色作为文字色
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.info-label {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-secondary-light;
}

.info-value {
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary-light;
}

.bio-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: $text-primary-light;
}

// 操作按钮区域
.action-buttons {
  padding: 0 24rpx 60rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 88rpx;
  border-radius: $border-radius;
  font-size: 32rpx;
  font-weight: 600;
  transition: $transition;
  box-shadow: $shadow-light;
  position: relative;
  overflow: hidden;
  z-index: 1;

  &:active {
    transform: translateY(2rpx);
  }
}

// 第一个按钮特效（编辑资料、修改密码）
.effect-btn-1 {
  border-radius: 44rpx;
  border: none;
  box-shadow:
    6rpx 6rpx 12rpx #c5c5c5,
    -6rpx -6rpx 12rpx #ffffff;

  &::before {
    content: '';
    width: 0;
    height: 88rpx;
    border-radius: 44rpx;
    position: absolute;
    top: 0;
    left: 0;
    background-image: $effect1-gradient;
    transition: 0.5s ease;
    display: block;
    z-index: -1;
  }

  &:active::before {
    width: 100%;
  }

  .btn-text {
    position: relative;
    z-index: 2;
  }
}

.primary-btn {
  background: $primary-gradient;
  color: white;

  &.effect-btn-1 {
    background: transparent;
    color: $text-primary-light;

    &:active {
      color: white;
    }
  }
}

.secondary-btn {
  background: $card-bg-light;
  color: $text-primary-light;
  border: 2rpx solid $border-light;

  &.effect-btn-1 {
    background: transparent;
    border: none;

    &:active {
      color: white;
    }
  }
}

// 第二个按钮特效（保存、取消）
.effect-btn-2 {
  border-radius: 10rpx;
  border: 1rpx solid #3c096c;

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
    background: $effect2-gradient1;
  }

  &::after {
    right: -10rpx;
    background: $effect2-gradient2;
  }

  &:active::before,
  &:active::after {
    width: 58%;
  }

  &:active .btn-text {
    color: #e0aaff;
    transition: 0.3s;
  }

  .btn-text {
    color: #3c096c;
    transition: all 0.3s ease-in;
  }
}

.btn-text {
  font-weight: 600;
}

// 响应式设计
@media (max-width: 750rpx) {
  .nav-content {
    padding: 16rpx 20rpx;
  }

  .avatar-section {
    padding: 40rpx 20rpx 32rpx;
  }

  .avatar-wrapper,
  .avatar-text {
    width: 140rpx;
    height: 140rpx;
  }

  .avatar-text text {
    font-size: 48rpx;
  }

  .info-cards {
    padding: 0 20rpx 32rpx;
  }

  .action-buttons {
    padding: 0 20rpx 40rpx;
  }
}
</style>
