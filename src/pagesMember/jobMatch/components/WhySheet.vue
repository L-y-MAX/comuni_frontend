<template>
  <view
    v-if="visible"
    class="why-mask"
    @click="close"
  >
    <view
      class="why-sheet"
      @click.stop
    >
      <view class="why-head">
        <view class="why-head-main">
          <text class="why-title">
            {{ mode === 'score' ? '匹配度构成' : gap?.label || '维度依据' }}
          </text>
          <text
            v-if="mode === 'dimension' && gap"
            class="why-sub"
          >
            {{ gap.fitPercent }}% · {{ statusText(gap) }}
          </text>
          <text
            v-else-if="match"
            class="why-sub"
          >
            {{ match.jobName }} · {{ match.matchScore }}% · {{ match.matchLevelLabel }}
          </text>
        </view>
        <text
          class="why-close"
          @click="close"
        >
          关闭
        </text>
      </view>

      <scroll-view
        scroll-y
        class="why-body"
      >
        <!-- 维度模式 -->
        <block v-if="mode === 'dimension' && gap">
          <view class="block">
            <view class="block-head">
              <text class="block-title">岗位要求</text>
              <text class="block-score">{{ gap.requiredScore }} 分</text>
            </view>
            <text class="meta-line">
              {{ sourceLabel(gap.jobSource) }} · 置信度 {{ toPercent(gap.jobConfidence) }}
            </text>

            <text
              v-for="(item, i) in gap.jobEvidence"
              :key="`job-${i}`"
              class="quote"
            >
              {{ item }}
            </text>

            <view
              v-if="jobDimension?.skills?.length"
              class="tag-list"
            >
              <text
                v-for="(s, i) in jobDimension.skills"
                :key="`skill-${i}`"
                class="tag"
                :class="s.requirement"
              >
                {{ s.name }}{{ s.requirement === 'must' ? ' 必须' : ' 优先' }}
              </text>
            </view>
            <view
              v-if="jobDimension?.certificates?.length"
              class="tag-list"
            >
              <text
                v-for="(c, i) in jobDimension.certificates"
                :key="`cert-${i}`"
                class="tag"
                :class="c.requirement"
              >
                {{ c.name }}{{ c.requirement === 'must' ? ' 必须' : ' 优先' }}
              </text>
            </view>

            <text
              v-if="gap.coverage"
              class="meta-line"
            >
              要求 {{ gap.coverage.total }} 项，已覆盖 {{ gap.coverage.matched }} 项
            </text>
          </view>

          <view class="block">
            <view class="block-head">
              <text class="block-title">我的情况</text>
              <text class="block-score">{{ gap.studentScore }} 分</text>
            </view>
            <text class="meta-line">
              {{ sourceLabel(gap.studentSource) }} · 置信度 {{ toPercent(gap.studentConfidence) }}
            </text>

            <text
              v-for="(item, i) in gap.studentEvidence"
              :key="`stu-${i}`"
              class="quote"
            >
              {{ item }}
            </text>
            <text
              v-if="!gap.studentEvidence.length"
              class="meta-line"
            >
              资料中未识别到这一维的描述
            </text>

            <text
              v-if="gap.studentParseDetail?.score_formula"
              class="formula"
            >
              {{ gap.studentParseDetail.score_formula }}
            </text>
            <text
              v-if="gap.studentParseDetail"
              class="meta-line"
            >
              命中：{{ joinOrNone(gap.studentParseDetail.matched_keywords) }}
            </text>
            <text
              v-if="gap.studentParseDetail"
              class="meta-line"
            >
              缺少：{{ joinOrNone(gap.studentParseDetail.missed_keywords) }}
            </text>
          </view>

          <view class="block">
            <text class="block-title">计算方式</text>
            <view class="kv-row">
              <text class="kv-key">口径</text>
              <text class="kv-value">
                {{ gap.basis === 'coverage' ? '要求条目覆盖率' : '学生分 / 岗位要求分' }}
              </text>
            </view>
            <view class="kv-row">
              <text class="kv-key">权重</text>
              <text class="kv-value">{{ toPercent(gap.effectiveWeight) }}</text>
            </view>
            <text
              v-if="gap.noRequirement"
              class="short-note"
            >
              这一维岗位未提要求，不参与评分
            </text>
            <text
              v-else-if="gap.insufficientInfo"
              class="short-note"
            >
              资料不足，按“信息不足”处理
            </text>
          </view>

          <view
            v-if="match"
            class="block"
          >
            <text class="block-title">总分构成</text>
            <view class="kv-row">
              <text class="kv-key">基础分</text>
              <text class="kv-value">{{ match.scoreBreakdown.baseScore }}%</text>
            </view>
            <view class="kv-row">
              <text class="kv-key">技能/证书扣分</text>
              <text class="kv-value">-{{ match.scoreBreakdown.skillPenalty }}%</text>
            </view>
            <view
              v-if="match.scoreBreakdown.gateCap !== null"
              class="kv-row"
            >
              <text class="kv-key">核心技能封顶</text>
              <text class="kv-value">{{ match.scoreBreakdown.gateCap }}%</text>
            </view>
            <view
              v-if="match.scoreBreakdown.infoCap !== null"
              class="kv-row"
            >
              <text class="kv-key">信息不足封顶</text>
              <text class="kv-value">{{ match.scoreBreakdown.infoCap }}%</text>
            </view>
            <view class="kv-row kv-row--total">
              <text class="kv-key">最终匹配度</text>
              <text class="kv-value">{{ match.scoreBreakdown.finalScore }}%</text>
            </view>
            <text
              v-if="match.scoreNotes.gate"
              class="short-note"
            >
              {{ match.scoreNotes.gate }}
            </text>
            <text
              v-if="match.scoreNotes.info"
              class="short-note"
            >
              {{ match.scoreNotes.info }}
            </text>
          </view>
        </block>

        <!-- 总分模式 -->
        <block v-else-if="mode === 'score' && match">
          <view class="score-hero">
            <text class="score-big">{{ match.matchScore }}<text class="score-unit">%</text></text>
            <text class="score-level">{{ match.matchLevelLabel }}</text>
            <text class="score-meta">
              达标 {{ match.satisfiedCount }}/{{ match.totalCount }} · 可评估
              {{ match.evaluatedDimCount }}/10 · 置信度 {{ toPercent(match.confidence) }}
            </text>
          </view>

          <view class="block">
            <text class="block-title">总分拆解</text>
            <view class="kv-row">
              <text class="kv-key">基础分</text>
              <text class="kv-value">{{ match.scoreBreakdown.baseScore }}%</text>
            </view>
            <view class="kv-row">
              <text class="kv-key">技能/证书扣分</text>
              <text class="kv-value">-{{ match.scoreBreakdown.skillPenalty }}%</text>
            </view>
            <view class="kv-row">
              <text class="kv-key">核心技能封顶</text>
              <text class="kv-value">
                {{ match.scoreBreakdown.gateCap === null ? '未触发' : `${match.scoreBreakdown.gateCap}%` }}
              </text>
            </view>
            <view class="kv-row">
              <text class="kv-key">信息不足封顶</text>
              <text class="kv-value">
                {{ match.scoreBreakdown.infoCap === null ? '未触发' : `${match.scoreBreakdown.infoCap}%` }}
              </text>
            </view>
            <view class="kv-row kv-row--total">
              <text class="kv-key">最终匹配度</text>
              <text class="kv-value">{{ match.scoreBreakdown.finalScore }}%</text>
            </view>
            <text
              v-if="match.scoreNotes.gate"
              class="short-note"
            >
              {{ match.scoreNotes.gate }}
            </text>
            <text
              v-if="match.scoreNotes.info"
              class="short-note"
            >
              {{ match.scoreNotes.info }}
            </text>
          </view>

          <view class="block">
            <text class="block-title">四类得分</text>
            <view
              v-for="cat in match.categories"
              :key="cat.key"
              class="cat-row"
            >
              <text class="cat-name">{{ cat.label }}</text>
              <view class="cat-right">
                <text
                  class="cat-score"
                  :class="{ off: !cat.active }"
                >
                  {{ cat.active ? cat.score : '—' }}
                </text>
                <text class="cat-weight">{{ toPercent(cat.weight) }}</text>
              </view>
            </view>
          </view>
        </block>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { PARSE_SOURCE_LABEL, type ParseSource, type JobDimension } from '@/types/jobProfile'
import type { MatchResult, DimensionGap } from '../lib/jobMatchTypes'

withDefaults(
  defineProps<{
    visible: boolean
    mode?: 'dimension' | 'score'
    gap?: DimensionGap | null
    match?: MatchResult | null
    jobDimension?: JobDimension | null
  }>(),
  {
    mode: 'dimension',
    gap: null,
    match: null,
    jobDimension: null,
  },
)

const emit = defineEmits<{ (e: 'close'): void }>()

const close = () => emit('close')
const toPercent = (v: number) => `${Math.round((v || 0) * 100)}%`
const sourceLabel = (source: ParseSource) => PARSE_SOURCE_LABEL[source] ?? source
const joinOrNone = (list?: string[]) => (list && list.length ? list.join('、') : '无')

const statusText = (gap: DimensionGap) => {
  if (gap.noRequirement) return '未提要求'
  if (gap.satisfied) return '已达标'
  if (gap.insufficientInfo) return '信息不足'
  return gap.basis === 'coverage' ? '覆盖不足' : '未达标'
}
</script>

<style scoped lang="scss">
.why-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  background: rgba(23, 25, 28, 0.45);
  display: flex;
  align-items: flex-end;
}

.why-sheet {
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  overflow: hidden;
}

.why-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #ececf0;
}

.why-head-main {
  flex: 1;
  min-width: 0;
}

.why-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #17191c;
  line-height: 1.4;
}

.why-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.why-close {
  flex: none;
  margin-left: 24rpx;
  padding: 6rpx 0 6rpx 16rpx;
  font-size: 28rpx;
  color: #5b616b;
}

.why-body {
  height: 62vh;
  padding: 0 32rpx 40rpx;
  box-sizing: border-box;
}

.block {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f2f3f5;
}

.block:last-child {
  border-bottom: none;
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.block-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #17191c;
}

.block-score {
  font-size: 30rpx;
  font-weight: 600;
  color: #17191c;
}

.meta-line {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9aa0a8;
  line-height: 1.6;
}

.quote {
  display: block;
  margin-top: 10rpx;
  padding: 12rpx 0 12rpx 16rpx;
  border-left: 4rpx solid #ff8558;
  font-size: 26rpx;
  line-height: 1.65;
  color: #33373d;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.tag {
  margin: 0 16rpx 8rpx 0;
  font-size: 24rpx;
  color: #5b616b;
}

.tag.must {
  color: #17191c;
  font-weight: 500;
}

.formula {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: #5b616b;
}

.kv-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8rpx 0;
}

.kv-key {
  flex: none;
  width: 200rpx;
  font-size: 26rpx;
  color: #5b616b;
}

.kv-value {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  color: #17191c;
  line-height: 1.6;
}

.kv-row--total {
  margin-top: 8rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #ececf0;
}

.kv-row--total .kv-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #ff8558;
}

.short-note {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9aa0a8;
}

.score-hero {
  padding: 28rpx 0 24rpx;
  text-align: center;
  border-bottom: 1rpx solid #f2f3f5;
}

.score-big {
  font-size: 88rpx;
  font-weight: 600;
  color: #ff8558;
  line-height: 1;
}

.score-unit {
  font-size: 32rpx;
  font-weight: 500;
}

.score-level {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  color: #17191c;
}

.score-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}

.cat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f7f8fa;
}

.cat-row:last-child {
  border-bottom: none;
}

.cat-name {
  font-size: 28rpx;
  color: #17191c;
}

.cat-right {
  display: flex;
  align-items: baseline;
}

.cat-score {
  font-size: 30rpx;
  font-weight: 600;
  color: #17191c;
}

.cat-score.off {
  color: #c8ccd2;
}

.cat-weight {
  margin-left: 12rpx;
  font-size: 24rpx;
  color: #9aa0a8;
}
</style>
