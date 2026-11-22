<template>
  <view class="whatif">
    <view
      class="whatif-head"
      @click="open = !open"
    >
      <text class="whatif-title">补差模拟</text>
      <text class="whatif-toggle">{{ open ? '收起' : '展开' }}</text>
    </view>

    <view
      v-if="open"
      class="whatif-body"
    >
      <view
        v-if="!options.length"
        class="empty"
      >
        暂无可提升项
      </view>

      <block v-else>
        <scroll-view
          scroll-y
          class="option-list"
        >
          <view
            v-for="opt in options"
            :key="opt.id"
            class="option"
            @click="toggle(opt.id)"
          >
            <view
              class="check"
              :class="{ on: isSelected(opt.id) }"
            />
            <view class="option-main">
              <text class="option-name">{{ opt.name }}</text>
              <text class="option-tag">
                {{ kindLabel(opt) }}
                <text v-if="opt.requirement === 'must'"> · 必须</text>
              </text>
            </view>
            <text
              class="option-delta"
              :class="{ zero: opt.delta <= 0 }"
            >
              {{ opt.delta > 0 ? `+${opt.delta}%` : '—' }}
            </text>
          </view>
        </scroll-view>

        <view class="whatif-footer">
          <view class="score-change">
            <text class="score-now">{{ base.matchScore }}%</text>
            <text class="score-arrow">→</text>
            <text class="score-next">{{ simulatedScore }}%</text>
          </view>
          <button
            class="plan-btn"
            :disabled="!selectedIds.length"
            @click="savePlan"
          >
            加入计划
          </button>
        </view>
      </block>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JobProfile } from '@/types/jobProfile'
import type { StudentProfile } from '@/types/studentProfile'
import type { MatchResult } from '../lib/jobMatchTypes'
import {
  buildWhatIfOptions,
  saveWhatIfPlan,
  simulateWhatIf,
  type WhatIfOption,
  type WhatIfPlan,
} from '../lib/whatIf'

const props = defineProps<{
  student: StudentProfile
  job: JobProfile
  base: MatchResult
}>()

const emit = defineEmits<{ (e: 'saved', plan: WhatIfPlan): void }>()

const open = ref(false)
const selectedIds = ref<string[]>([])
const options = buildWhatIfOptions(props.student, props.job, props.base)

const isSelected = (id: string) => selectedIds.value.includes(id)

const toggle = (id: string) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const selectedOptions = computed<WhatIfOption[]>(() =>
  options.filter((opt) => selectedIds.value.includes(opt.id)),
)

const simulatedScore = computed(() => {
  if (!selectedOptions.value.length) return props.base.matchScore
  return simulateWhatIf(props.student, props.job, selectedOptions.value).match.matchScore
})

const kindLabel = (opt: WhatIfOption) => {
  if (opt.kind === 'skill') return '技能'
  if (opt.kind === 'certificate') return '证书'
  return '能力'
}

const savePlan = () => {
  if (!selectedOptions.value.length) return
  const plan: WhatIfPlan = {
    jobId: props.job.recruitment_id || props.job.job_name,
    jobName: props.job.job_name,
    baseScore: props.base.matchScore,
    simulatedScore: simulatedScore.value,
    items: selectedOptions.value.map((opt) => ({
      id: opt.id,
      name: opt.name,
      kind: opt.kind,
      requirement: opt.requirement,
      delta: opt.delta,
    })),
    createdAt: Date.now(),
  }
  saveWhatIfPlan(plan)
  uni.showToast({ title: '已加入计划', icon: 'none' })
  emit('saved', plan)
}
</script>

<style scoped lang="scss">
.whatif {
  margin-top: 8rpx;
  border-top: 1rpx solid #f2f3f5;
}

.whatif-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0 10rpx;
}

.whatif-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #17191c;
}

.whatif-toggle {
  font-size: 24rpx;
  color: #9aa0a8;
}

.whatif-body {
  padding-bottom: 8rpx;
}

.option-list {
  max-height: 420rpx;
}

.option {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f7f8fa;
}

.option:last-child {
  border-bottom: none;
}

.check {
  flex: none;
  width: 28rpx;
  height: 28rpx;
  margin-right: 16rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 50%;
  box-sizing: border-box;
}

.check.on {
  background: #ff8558;
  border-color: #ff8558;
}

.option-main {
  flex: 1;
  min-width: 0;
}

.option-name {
  display: block;
  font-size: 26rpx;
  color: #17191c;
  line-height: 1.4;
}

.option-tag {
  display: block;
  margin-top: 2rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.option-delta {
  flex: none;
  margin-left: 16rpx;
  font-size: 26rpx;
  color: #ff8558;
}

.option-delta.zero {
  color: #c8ccd2;
}

.empty {
  padding: 20rpx 0;
  font-size: 24rpx;
  color: #9aa0a8;
}

.whatif-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16rpx;
  border-top: 1rpx solid #f2f3f5;
}

.score-change {
  display: flex;
  align-items: baseline;
}

.score-now {
  font-size: 26rpx;
  color: #9aa0a8;
}

.score-arrow {
  margin: 0 10rpx;
  font-size: 24rpx;
  color: #c8ccd2;
}

.score-next {
  font-size: 32rpx;
  font-weight: 600;
  color: #ff8558;
}

.plan-btn {
  margin: 0;
  padding: 0 28rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 24rpx;
  color: #ffffff;
  background: #ff8558;
  border-radius: 8rpx;

  &::after {
    border: none;
  }

  &:disabled {
    opacity: 0.5;
  }
}
</style>
