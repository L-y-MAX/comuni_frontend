<template>
  <view class="employment-tabs">
    <view
      class="employment-tab"
      :class="{ active: active === 'jobs' }"
      @click="goJobs"
    >
      岗位招聘
    </view>
    <view
      class="employment-tab"
      :class="{ active: active === 'policy' }"
      @click="goPolicy"
    >
      政策资源
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  active: 'jobs' | 'policy'
}>()

const goJobs = () => {
  if (props.active === 'jobs') return
  uni.redirectTo({ url: '/pagesMember/recruitment/recruitment-list' })
}

const goPolicy = () => {
  if (props.active === 'policy') return
  uni.redirectTo({ url: '/pagesMember/careerResources/careerResources' })
}
</script>

<style scoped lang="scss">
.employment-tabs {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-bottom: 1rpx solid #ececf0;
}

.employment-tab {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  font-size: 28rpx;
  color: #5b616b;
  position: relative;
}

.employment-tab.active {
  color: #ff8558;
  font-weight: 600;
}

.employment-tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 48rpx;
  height: 4rpx;
  background: #ff8558;
  border-radius: 2rpx;
  transform: translateX(-50%);
}
</style>
