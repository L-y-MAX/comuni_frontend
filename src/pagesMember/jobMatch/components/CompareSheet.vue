<template>
  <view
    v-if="visible"
    class="compare-mask"
    @click="close"
  >
    <view
      class="compare-sheet"
      @click.stop
    >
      <view class="compare-head">
        <view class="compare-head-main">
          <text class="compare-title">岗位对比</text>
          <text class="compare-sub">按匹配度、必须技能缺口排序</text>
        </view>
        <text
          class="compare-close"
          @click="close"
        >
          关闭
        </text>
      </view>

      <scroll-view
        scroll-x
        class="compare-scroll"
      >
        <view
          class="compare-table"
          :style="{ width: tableWidth }"
        >
          <!-- 表头：岗位 + 分数 -->
          <view class="compare-row compare-head-row">
            <view class="compare-label">岗位</view>
            <view
              v-for="(job, idx) in ranked"
              :key="job.jobId"
              class="compare-cell"
            >
              <text class="rank">#{{ idx + 1 }}</text>
              <text class="job-name">{{ job.jobName }}</text>
              <text class="ent-name">{{ job.enterpriseName || '未提供企业' }}</text>
              <text class="job-score">{{ job.matchScore }}%</text>
            </view>
          </view>

          <!-- 十维 -->
          <view
            v-for="dim in dimensions"
            :key="dim.key"
            class="compare-row"
          >
            <view class="compare-label">{{ dim.label }}</view>
            <view
              v-for="job in ranked"
              :key="`${job.jobId}-${dim.key}`"
              class="compare-cell"
            >
              <text
                class="cell-value"
                :class="{ best: isBestFit(job, dim.key) }"
              >
                {{ fitText(job, dim.key) }}
              </text>
            </view>
          </view>

          <!-- 必须技能缺口 -->
          <view class="compare-row">
            <view class="compare-label">必须技能缺口</view>
            <view
              v-for="job in ranked"
              :key="`${job.jobId}-must`"
              class="compare-cell"
            >
              <text
                class="cell-value"
                :class="{ best: job.missingMustSkills === bestMust }"
              >
                {{ job.missingMustSkills }}
              </text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="compare-foot">
        <text class="foot-text">
          首选：{{ ranked[0]?.jobName }}（{{ ranked[0]?.matchScore }}%，必须技能缺口
          {{ ranked[0]?.missingMustSkills }}）
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DimensionGap, MatchResult } from '../lib/jobMatchTypes'

const props = defineProps<{
  visible: boolean
  matches: MatchResult[]
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const close = () => emit('close')

const ranked = computed(() =>
  [...props.matches].sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      a.missingMustSkills - b.missingMustSkills ||
      a.skillGaps.length - b.skillGaps.length,
  ),
)

const dimensions = computed(() => {
  const first = ranked.value[0]
  return first ? first.gaps.map((g) => ({ key: g.key, label: g.label })) : []
})

const gapOf = (job: MatchResult, key: string): DimensionGap | undefined =>
  job.gaps.find((g) => g.key === key)

const fitText = (job: MatchResult, key: string) => {
  const gap = gapOf(job, key)
  return !gap || gap.noRequirement ? '—' : `${gap.fitPercent}%`
}

const bestFit = (key: string) =>
  Math.max(
    ...ranked.value.map((job) => {
      const gap = gapOf(job, key)
      return gap && !gap.noRequirement ? gap.fitPercent : -1
    }),
  )

const isBestFit = (job: MatchResult, key: string) => {
  const gap = gapOf(job, key)
  return !!gap && !gap.noRequirement && gap.fitPercent === bestFit(key)
}

const bestMust = computed(() =>
  Math.min(...ranked.value.map((job) => job.missingMustSkills)),
)

const tableWidth = computed(() => `${160 + ranked.value.length * 220}rpx`)
</script>

<style scoped lang="scss">
.compare-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 950;
  background: rgba(23, 25, 28, 0.45);
  display: flex;
  align-items: flex-end;
}

.compare-sheet {
  width: 100%;
  height: 82vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  overflow: hidden;
}

.compare-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #ececf0;
}

.compare-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #17191c;
}

.compare-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.compare-close {
  flex: none;
  margin-left: 24rpx;
  padding: 6rpx 0 6rpx 16rpx;
  font-size: 28rpx;
  color: #5b616b;
}

.compare-scroll {
  flex: none;
  height: 60vh;
  padding: 8rpx 0;
  box-sizing: border-box;
}

.compare-table {
  display: flex;
  flex-direction: column;
}

.compare-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1rpx solid #f2f3f5;
}

.compare-head-row {
  border-bottom: 1rpx solid #ececf0;
}

.compare-label {
  flex: none;
  width: 160rpx;
  padding: 16rpx 12rpx;
  font-size: 24rpx;
  color: #5b616b;
  background: #fafbfc;
  box-sizing: border-box;
}

.compare-cell {
  flex: none;
  width: 220rpx;
  padding: 16rpx 12rpx;
  box-sizing: border-box;
  text-align: center;
}

.rank {
  display: block;
  font-size: 24rpx;
  color: #9aa0a8;
}

.job-name {
  display: block;
  margin-top: 4rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #17191c;
  line-height: 1.4;
}

.ent-name {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #9aa0a8;
  line-height: 1.4;
}

.job-score {
  display: block;
  margin-top: 8rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #ff8558;
}

.cell-value {
  font-size: 26rpx;
  color: #17191c;
}

.cell-value.best {
  color: #ff8558;
  font-weight: 600;
}

.compare-foot {
  padding: 18rpx 32rpx;
  border-top: 1rpx solid #ececf0;
}

.foot-text {
  display: block;
  font-size: 24rpx;
  color: #5b616b;
  line-height: 1.6;
}
</style>
