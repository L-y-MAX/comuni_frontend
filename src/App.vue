<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { post } from '@/utils/request'

onLaunch(async () => {
  // 检查本地是否有Token
  const accessToken = uni.getStorageSync('accessToken')
  if (accessToken) {
    try {
      // 验证Token有效性
      await post('/api/v1/token/verify/', { token: accessToken })
      // Token有效，跳转到首页
      uni.switchTab({ url: '/pages/index/index' })
    } catch (error) {
      // Token无效，清除并跳转到登录页
      uni.removeStorageSync('accessToken')
      uni.removeStorageSync('refreshToken')
      uni.navigateTo({ url: '/pagesMember/login/login' })
    }
  } else {
    // 无Token，跳转到登录页
    uni.navigateTo({ url: '/pagesMember/login/login' })
  }
})

onLaunch(() => {
  console.log('App Launch')
})
onShow(() => {
  console.log('App Show')
})
onHide(() => {
  console.log('App Hide')
})
</script>
<style></style>
