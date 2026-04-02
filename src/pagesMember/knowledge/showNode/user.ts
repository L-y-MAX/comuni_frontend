// /stores/user.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo, VipInfo } from '@/types/user'

export const useUserStore = defineStore('user', () => {
  // 初始化用户信息和VIP信息
  const userInfo = ref<UserInfo | null>(null)
  const vipInfo = ref<VipInfo | null>(null)

  // 从本地存储加载数据
  const loadFromStorage = () => {
    try {
      // 加载用户信息
      const storedUser = uni.getStorageSync('userInfo')
      if (storedUser) {
        // 兼容字符串和对象两种存储格式
        userInfo.value = typeof storedUser === 'string'
          ? JSON.parse(storedUser)
          : storedUser
      }

      // 加载VIP信息
      const storedVip = uni.getStorageSync('vipInfo')
      if (storedVip) {
        vipInfo.value = typeof storedVip === 'string'
          ? JSON.parse(storedVip)
          : storedVip
      }
    } catch (error) {
      console.error('加载本地存储数据失败:', error)
    }
  }

  // 保存数据到本地存储
  const saveToStorage = () => {
    try {
      if (userInfo.value) {
        uni.setStorageSync('userInfo', JSON.stringify(userInfo.value))
      }
      if (vipInfo.value) {
        uni.setStorageSync('vipInfo', JSON.stringify(vipInfo.value))
      }
    } catch (error) {
      console.error('保存数据到本地存储失败:', error)
    }
  }

  // 更新用户信息
  const updateUserInfo = (data: Partial<UserInfo>) => {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...data }
    } else {
      userInfo.value = data as UserInfo
    }
    saveToStorage()
  }

  // 更新VIP信息
  const updateVipInfo = (data: VipInfo) => {
    vipInfo.value = data
    saveToStorage()
  }

  // 清除用户信息（退出登录时使用）
  const clearUserInfo = () => {
    userInfo.value = null
    vipInfo.value = null
    try {
      uni.removeStorageSync('userInfo')
      uni.removeStorageSync('vipInfo')
    } catch (e) {
      console.error('清除存储失败:', e)
    }
  }

  return {
    userInfo,
    vipInfo,
    updateUserInfo,
    updateVipInfo,
    clearUserInfo,
    loadFromStorage // 暴露加载方法，便于手动调用
  }
})
