<template>
  <div class="py-5">
    <h1 class="page-title">人员活动指标</h1>
    
    <!-- 使用 Element Plus 栅格系统创建响应式布局 -->
    <ElRow :gutter="40">
      
      <!-- 当日报案数量卡片 -->
      <ElCol :xs="24" :sm="12" :md="8" class="mb-5" >
        <ArtBarChartCard
          :value="currentReportNum.today"
          label="当日报案数"
          :percentage="calculatePercentage(currentReportNum.today, currentReportNum.yesterday)"
          :height="12"
          :chartData="currentReportNum.trendData"
          color="#3b82f6"
        />
      </ElCol>
      
      <!-- 当日立案数卡片 -->
      <ElCol :xs="24" :sm="12" :md="8" class="mb-5" >
        <ArtBarChartCard
          :value="currentFiledNum.count"
          label="当日立案数"
          :percentage="calculatePercentage(currentFiledNum.count, currentFiledNum.yesterday)"                       
          :height="12"
          :chartData="currentFiledNum.trendData"
          color="#10b981"
        />
      </ElCol>

      <!-- 当日结案数卡片 -->
      <ElCol :xs="24" :sm="12" :md="8" class="mb-5" >
        <ArtBarChartCard
          :value="currentEndedNum.count"
          label="当日结案数"
          :percentage="calculatePercentage(currentEndedNum.count, currentEndedNum.yesterday)"                       
          :height="12"
          :chartData="currentEndedNum.trendData"
          color="#06b6d4"
        />
      </ElCol>
    </ElRow>

    <!-- 附加指标行 -->
    <ElRow :gutter="20">
      <!-- 查勘量统计 -->
      <ElCol :xs="24" :sm="12" :md="12" class="mb-5">
        <ArtLineChartCard
          :value="inspectionVolume.total"
          label="查勘量"
          :percentage="calculatePercentage(inspectionVolume.total, inspectionVolume.lastMonth)"
          :height="12"
          :chartData="inspectionVolume.trendData"
          color="#ef4444"
        />
      </ElCol>
      
      <!-- 定损量统计 -->
      <ElCol :xs="24" :sm="12" :md="12" class="mb-5">
        <ArtLineChartCard
          :value="damageAssessment.total"
          label="定损量"
          :percentage="calculatePercentage(damageAssessment.total, damageAssessment.lastMonth)"
          :height="12"
          :showAreaColor="true"
          :chartData="damageAssessment.trendData"
          color="#ec4899"
        />
      </ElCol>
      
    </ElRow>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import ArtLineChartCard from '@/components/core/cards/art-line-chart-card/index.vue'
import ArtBarChartCard from '@/components/core/cards/art-bar-chart-card/index.vue'
import ArtDonutChartCard from '@/components/core/cards/art-donut-chart-card/index.vue'
import { ElRow, ElCol } from 'element-plus'

// 定义组件选项
defineOptions({ name: 'Indicator' })

// 响应式数据定义
const currentReportNum = reactive({
  today: 125,
  yesterday: 110,
  trendData: [98, 102, 115, 108, 120, 118, 110]
})

const currentFiledNum = reactive({
  count: 342,
  yesterday: 325,
  trendData: [310, 315, 320, 322, 328, 335, 325]
})

const currentEndedNum = reactive({
  count: 283,
  yesterday: 278,
  trendData: [283, 278, 273, 268, 263, 258, 278]
})

const inspectionVolume = reactive({
  total: 1548,
  lastMonth: 1420,
  trendData: [1320, 1350, 1400, 1420, 1480, 1520, 1420]
})

const damageAssessment = reactive({
  total: 892,
  lastMonth: 820,
  trendData: [780, 795, 810, 820, 850, 870, 820]
})

// 计算百分比变化的辅助函数
const calculatePercentage = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return Number(((current - previous) / previous * 100).toFixed(2))
}
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 600;
  /* color: #1f2937; */
  margin-bottom: 24px;
  padding-left: 10px;
}

.mb-5 {
  margin-bottom: 1.25rem;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .page-title {
    font-size: 20px;
  }
  
  .el-col {
    margin-bottom: 1rem !important;
  }
}
</style>