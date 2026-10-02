<template>
  <view class="history-page">
    <scroll-view
      scroll-y
      class="page-scroll"
    >
      <!-- 空态 -->
      <view
        v-if="!list.length"
        class="state-card card-style"
      >
        <text class="state-title">还没有历史报告</text>
        <text class="state-desc">
          每次生成生涯发展报告都会自动存档，之后可以在这里回看，并对比能力变化。
        </text>
        <button
          class="primary-btn"
          @click="goAbilityProfile"
        >
          去生成能力画像
        </button>
      </view>

      <block v-else>
        <!-- 概览 -->
        <view class="overview-card card-style">
          <view class="overview-item">
            <text class="overview-num">{{ list.length }}</text>
            <text class="overview-label">历史报告</text>
          </view>
          <view class="overview-divider" />
          <view class="overview-item">
            <text
              class="overview-num"
              :style="{ color: trendColor(latestDelta) }"
            >
              {{ formatDelta(latestDelta) }}
            </text>
            <text class="overview-label">较上一版竞争力</text>
          </view>
          <view class="overview-divider" />
          <view class="overview-item">
            <text class="overview-num">{{ latestProgress }}%</text>
            <text class="overview-label">最新计划完成率</text>
          </view>
        </view>

        <!-- 趋势条：竞争力变化曲线（纯 CSS 柱状） -->
        <view
          v-if="list.length >= 2"
          class="trend-card card-style"
        >
          <view class="card-head">
            <text class="section-title">能力变化趋势</text>
            <text class="section-sub">按生成时间从早到晚</text>
          </view>
          <view class="trend-bars">
            <view
              v-for="(e, i) in chronological"
              :key="e.id"
              class="trend-bar-wrap"
            >
              <text class="trend-value">{{ e.snapshot.competitiveness }}</text>
              <view class="trend-bar-track">
                <view
                  class="trend-bar-fill"
                  :style="{
                    height: `${Math.max(6, e.snapshot.competitiveness)}%`,
                    backgroundColor: i === chronological.length - 1 ? '#ff4500' : '#ffc4ad',
                  }"
                />
              </view>
              <text class="trend-date">{{ shortDate(e.generatedAt) }}</text>
            </view>
          </view>
        </view>

        <!-- 列表 -->
        <view
          v-for="(e, i) in list"
          :key="e.id"
          class="entry-card card-style"
          @click="openEntry(e)"
        >
          <view class="entry-head">
            <view class="entry-left">
              <text class="entry-date">{{ formatTime(e.generatedAt) }}</text>
              <text
                v-if="i === 0"
                class="entry-badge latest"
              >
                最新
              </text>
              <text
                v-if="e.ruleBased"
                class="entry-badge rule"
              >
                规则解析
              </text>
            </view>
            <text class="entry-arrow">›</text>
          </view>

          <view class="entry-metrics">
            <view class="metric">
              <text class="metric-num">{{ e.snapshot.competitiveness }}</text>
              <text class="metric-label">竞争力</text>
            </view>
            <view class="metric">
              <text class="metric-num">{{ e.snapshot.completeness }}%</text>
              <text class="metric-label">完整度</text>
            </view>
            <view class="metric">
              <text class="metric-num">{{ progressOf(e) }}%</text>
              <text class="metric-label">计划完成</text>
            </view>
          </view>

          <view class="entry-foot">
            <text class="entry-job">
              {{ e.snapshot.bestJobName || '无匹配岗位' }}
              <text
                v-if="e.snapshot.bestJobName"
                class="entry-score"
              >
                {{ e.snapshot.bestMatchScore }}%
              </text>
            </text>
            <text
              v-if="trendOf(i)"
              class="entry-trend"
              :style="{ color: trendColor(trendOf(i)!.competitivenessDelta) }"
            >
              {{ formatDelta(trendOf(i)!.competitivenessDelta) }}
            </text>
          </view>

          <view class="entry-actions">
            <text
              class="entry-action"
              @click.stop="copyEntry(e)"
            >
              复制全文
            </text>
            <text
              class="entry-action danger"
              @click.stop="confirmRemove(e)"
            >
              删除
            </text>
          </view>
        </view>

        <view class="action-row">
          <button
            class="ghost-btn"
            @click="confirmClear"
          >
            清空全部历史
          </button>
        </view>
      </block>

      <view class="page-footer-source">
        <text class="source-text">
          最多保留最近 {{ historyMax }} 份报告，超出后自动丢弃最旧的一份
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  REPORT_HISTORY_MAX,
  calcTrend,
  clearReportHistory,
  loadReportHistory,
  removeHistoryEntry,
  type ReportHistoryEntry,
} from '@/utils/reportHistory';

// ====================== 状态 ======================

const list = ref<ReportHistoryEntry[]>([]);
const historyMax = REPORT_HISTORY_MAX;

/**
 * 用 onShow 而不是 onLoad 重新读取：
 * 从详情页返回（可能改了任务勾选或删了条目）时要刷新列表。
 */
onShow(() => {
  list.value = loadReportHistory();
});

// ====================== 派生 ======================

/** 时间正序（用于趋势图，左旧右新） */
const chronological = computed(() => [...list.value].reverse());

const latestProgress = computed(() => (list.value[0] ? progressOf(list.value[0]) : 0));

/** 最新一份相比上一份的竞争力变化 */
const latestDelta = computed(() => {
  const t = calcTrend(list.value, 0);
  return t ? t.competitivenessDelta : 0;
});

const progressOf = (e: ReportHistoryEntry): number =>
  e.snapshot.taskTotal
    ? Math.round((e.snapshot.taskDone / e.snapshot.taskTotal) * 100)
    : 0;

const trendOf = (i: number) => calcTrend(list.value, i);

// ====================== 展示辅助 ======================

const pad = (n: number) => String(n).padStart(2, '0');

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatDelta = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

const trendColor = (n: number): string => {
  if (n > 0) return '#16a34a';
  if (n < 0) return '#dc2626';
  return '#94a3b8';
};

// ====================== 操作 ======================

/** 打开某份历史报告（带上 historyId，报告页会以「历史版本」模式加载） */
const openEntry = (e: ReportHistoryEntry) => {
  uni.navigateTo({
    url: `/pagesMember/careerReport/careerReport?historyId=${encodeURIComponent(e.id)}`,
    fail: (err) => {
      console.error('打开历史报告失败：', err);
      uni.showToast({ title: '打开失败，请重试', icon: 'none', duration: 2000 });
    },
  });
};

const copyEntry = (e: ReportHistoryEntry) => {
  uni.setClipboardData({
    data: e.report.markdown,
    success: () => uni.showToast({ title: '报告全文已复制', icon: 'success', duration: 1800 }),
    fail: () => uni.showToast({ title: '复制失败', icon: 'none', duration: 2000 }),
  });
};

const confirmRemove = (e: ReportHistoryEntry) => {
  uni.showModal({
    title: '删除这份报告？',
    content: `${formatTime(e.generatedAt)} 生成的报告将被删除，不可恢复。`,
    confirmText: '删除',
    confirmColor: '#dc2626',
    success: (res) => {
      if (!res.confirm) return;
      list.value = removeHistoryEntry(e.id);
      uni.showToast({ title: '已删除', icon: 'none', duration: 1500 });
    },
  });
};

const confirmClear = () => {
  uni.showModal({
    title: '清空全部历史？',
    content: `将删除全部 ${list.value.length} 份历史报告，不可恢复。`,
    confirmText: '清空',
    confirmColor: '#dc2626',
    success: (res) => {
      if (!res.confirm) return;
      clearReportHistory();
      list.value = [];
      uni.showToast({ title: '已清空', icon: 'none', duration: 1500 });
    },
  });
};

const goAbilityProfile = () => {
  uni.switchTab({ url: '/pages/abilityProfile/abilityProfile' });
};
</script>

<style scoped lang="scss">
.history-page {
  min-height: 100vh;
  background: #f8fafc;
  -webkit-tap-highlight-color: transparent;
}

.page-scroll {
  height: 100vh;
  padding: 20rpx;
  box-sizing: border-box;
}

.card-style {
  background: #fff;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.section-sub {
  font-size: 21rpx;
  color: #9ca3af;
}

// ========== 空态 ==========
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 70rpx 40rpx;
}

.state-icon {
  font-size: 78rpx;
  margin-bottom: 20rpx;
  opacity: 0.55;
}

.state-title {
  font-size: 31rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 14rpx;
}

.state-desc {
  font-size: 25rpx;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 26rpx;
}

// ========== 概览 ==========
.overview-card {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #fff5f1 0%, #fff 100%);
  border-color: #ffd9c7;
}

.overview-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.overview-divider {
  width: 1rpx;
  height: 76rpx;
  background: #ffe4d8;
}

.overview-num {
  font-size: 44rpx;
  font-weight: 700;
  color: #ff4500;
  line-height: 1.1;
}

.overview-label {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 6rpx;
}

// ========== 趋势 ==========
.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 260rpx;
  margin-top: 20rpx;
}

.trend-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.trend-value {
  font-size: 20rpx;
  color: #6b7280;
  margin-bottom: 6rpx;
}

.trend-bar-track {
  width: 40rpx;
  height: 170rpx;
  background: #f8fafc;
  border-radius: 8rpx;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.trend-bar-fill {
  width: 100%;
  border-radius: 8rpx;
  transition: height 0.4s ease;
}

.trend-date {
  font-size: 18rpx;
  color: #9ca3af;
  margin-top: 8rpx;
}

// ========== 列表条目 ==========
.entry-card {
  padding: 22rpx 24rpx;
}

.entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.entry-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.entry-date {
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
}

.entry-badge {
  font-size: 18rpx;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  margin-left: 10rpx;

  &.latest {
    background: #fff1eb;
    color: #ff4500;
    font-weight: 600;
  }

  &.rule {
    background: #f1f5f9;
    color: #94a3b8;
  }
}

.entry-arrow {
  font-size: 36rpx;
  color: #cbd5e1;
  line-height: 1;
}

.entry-metrics {
  display: flex;
  margin-top: 18rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 16rpx 0;
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-num {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.metric-label {
  font-size: 19rpx;
  color: #9ca3af;
  margin-top: 2rpx;
}

.entry-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.entry-job {
  font-size: 23rpx;
  color: #4b5563;
}

.entry-score {
  color: #ff4500;
  font-weight: 600;
  margin-left: 8rpx;
}

.entry-trend {
  font-size: 23rpx;
  font-weight: 700;
}

.entry-actions {
  display: flex;
  justify-content: flex-end;
  gap: 28rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #f1f5f9;
}

.entry-action {
  font-size: 22rpx;
  color: #64748b;

  &.danger {
    color: #dc2626;
  }
}

// ========== 按钮 ==========
.action-row {
  margin-top: 10rpx;
}

.primary-btn,
.ghost-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 16rpx;
  font-size: 27rpx;
  font-weight: 600;
  margin: 0;
  padding: 0;

  &::after {
    border: none;
  }
}

.primary-btn {
  background: #FF7239;
  color: #fff;
}

.ghost-btn {
  background: #fff;
  color: #94a3b8;
  border: 2rpx solid #e5e7eb;
}

// ========== 底部 ==========
.page-footer-source {
  text-align: center;
  padding: 24rpx 30rpx 60rpx;
}

.page-footer-source .source-text {
  font-size: 21rpx;
  color: #9ca3af;
  font-style: italic;
  line-height: 1.5;
}
</style>
