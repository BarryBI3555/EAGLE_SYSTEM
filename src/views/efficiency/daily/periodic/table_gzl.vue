<template>
  <div class="page-wrapper">
    <div class="toolbar" style="padding: 12px 20px; display: flex; align-items: center; gap: 8px;">
      <el-date-picker
        v-model="queryTime"
        type="date"
        value-format="yyyy-MM-dd"
        placeholder="选择日期"
        style="width: 170px;"
        size="small"
      />
      <el-button type="primary" size="small" @click="fetchData">查询</el-button>
      <el-button type="primary" size="small" @click="exportExcel">导出Excel</el-button>
      <el-input v-model="searchKey" placeholder="搜索表格内容" style="width: 170px;" size="small" clearable />
      <el-dropdown trigger="click" :hide-on-click="false" ref="dropdownRef">
        <el-button type="primary" size="small">筛选列表 <i class="el-icon-arrow-down el-icon--right"></i></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item divided><el-checkbox v-model="checkAll" @change="handleCheckAll">全选</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.deptName">部门</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.groupName">小组</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.staffName">人员</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.shiftType">排班</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.standardWorkload">标准工作量</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.surveyCount">当日查勘量</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.surveyUnfinished">当日查勘未完成</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.damageSubmit">当日定损提交</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.damageFinish">当日定损完成</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.damagePay">当日定损支付量</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.firstFollow">当日首跟</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.mediation">当日调解</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.caseClose">当日结案</el-checkbox></el-dropdown-item>
            <el-dropdown-item><el-checkbox v-model="tempColShow.totalWorkload">合计工作量</el-checkbox></el-dropdown-item>
            <el-dropdown-item divided style="text-align:center;"><el-button type="primary" size="small" @click="confirmColSelect">确认</el-button></el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div style="padding: 0 20px 8px; font-size: 14px; color: #409eff; font-weight: 500;">四川省工作量通报(gzl_ss)</div>

    <div style="width: 100%; overflow: auto;">
      <div style="width: 100%; overflow-x: auto; padding-bottom: 10px;">
        <el-table
          :data="sortedTableData"
          border
          stripe
          v-loading="loading"
          style="width: 100%; min-width: 1700px"
          max-height="calc(100vh - 160px)"
          @sort-change="handleSortChange"
          :scrollbar-always-on="true"
        >
          <el-table-column label="序号" type="index" width="70" fixed />
          <el-table-column label="部门" prop="deptName" width="220" fixed v-if="colShow.deptName" sortable="custom" />
          <el-table-column label="小组" prop="groupName" width="140" v-if="colShow.groupName" sortable />
          <el-table-column label="人员" prop="staffName" width="140" v-if="colShow.staffName" sortable />
          <el-table-column label="排班" prop="shiftType" width="140" v-if="colShow.shiftType" sortable />
          <el-table-column label="标准工作量" prop="standardWorkload" width="140" v-if="colShow.standardWorkload" sortable />
          <el-table-column label="当日查勘量" prop="surveyCount" width="140" v-if="colShow.surveyCount" sortable />
          <el-table-column label="当日查勘未完成" prop="surveyUnfinished" width="170" v-if="colShow.surveyUnfinished" sortable />
          <el-table-column label="当日定损提交" prop="damageSubmit" width="160" v-if="colShow.damageSubmit" sortable />
          <el-table-column label="当日定损完成" prop="damageFinish" width="160" v-if="colShow.damageFinish" sortable />
          <el-table-column label="当日定损支付量" prop="damagePay" width="160" v-if="colShow.damagePay" sortable />
          <el-table-column label="当日首跟" prop="firstFollow" width="120" v-if="colShow.firstFollow" sortable />
          <el-table-column label="当日调解" prop="mediation" width="120" v-if="colShow.mediation" sortable />
          <el-table-column label="当日结案" prop="caseClose" width="120" v-if="colShow.caseClose" sortable />
          <el-table-column label="合计工作量" prop="totalWorkload" width="140" v-if="colShow.totalWorkload" sortable />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'

const queryTime = ref('')
const tableData = ref([])
const loading = ref(false)
const searchKey = ref('')
const dropdownRef = ref(null)

const sortConfig = ref({ prop: 'deptName', order: 'ascending' })

const colShow = ref({
  deptName: true,
  groupName: true,
  staffName: true,
  shiftType: true,
  standardWorkload: true,
  surveyCount: true,
  surveyUnfinished: true,
  damageSubmit: true,
  damageFinish: true,
  damagePay: true,
  firstFollow: true,
  mediation: true,
  caseClose: true,
  totalWorkload: true
})

const tempColShow = ref(JSON.parse(JSON.stringify(colShow.value)))
const checkAll = ref(true)

const handleCheckAll = (val) => {
  Object.keys(tempColShow.value).forEach(k => { tempColShow.value[k] = val })
}

const confirmColSelect = () => {
  colShow.value = JSON.parse(JSON.stringify(tempColShow.value))
  dropdownRef.value?.handleClose()
}

watch(tempColShow, () => {
  checkAll.value = Object.values(tempColShow.value).every(v => v)
}, { deep: true })

const filteredTableData = computed(() => {
  if (!searchKey.value) return tableData.value
  const k = searchKey.value.toLowerCase()
  return tableData.value.filter(item =>
    Object.values(item).some(v => v != null && String(v).toLowerCase().includes(k))
  )
})

const sortedTableData = computed(() => {
  const arr = [...filteredTableData.value]
  const { prop, order } = sortConfig.value
  if (!prop) return arr
  return arr.sort((a, b) => {
    if (prop === 'deptName') {
      const cmp = (a.deptName || '').localeCompare(b.deptName || '', 'zh-CN')
      return order === 'ascending' ? cmp : -cmp
    }
    const va = Number(a[prop]) || 0
    const vb = Number(b[prop]) || 0
    return order === 'ascending' ? va - vb : vb - va
  })
})

const handleSortChange = ({ prop, order }) => {
  sortConfig.value = { prop, order }
}

// ✅ 核心：彻底修复请求，移除兜底，强制打印日志
const fetchData = async () => {
  loading.value = true
  try {
    console.log('【前端请求】参数：', { queryTime: queryTime.value })
    const res = await axios.get('http://localhost:8080/api/gzlSs/list', {
      // params: { queryTime: queryTime.value },
      timeout: 10000
    })
    console.log('【后端返回】完整数据：', res.data)
    tableData.value = res.data.data || []
    nextTick(() => {
      // 解决 ResizeObserver 警告
      window.dispatchEvent(new Event('resize'))
    })
  } catch (e) {
    console.error('【请求失败】详细错误：', e)
    tableData.value = []
    alert('数据加载失败，请检查后端服务和跨域配置！')
  } finally {
    loading.value = false
  }
}

const exportExcel = () => {
  if (!sortedTableData.value.length) {
    alert('暂无数据')
    return
  }
  const data = sortedTableData.value.map((it, idx) => ({
    '序号': idx + 1,
    '部门': it.deptName,
    '小组': it.groupName,
    '人员': it.staffName,
    '排班': it.shiftType,
    '标准工作量': it.standardWorkload,
    '当日查勘量': it.surveyCount,
    '当日查勘未完成': it.surveyUnfinished,
    '当日定损提交': it.damageSubmit,
    '当日定损完成': it.damageFinish,
    '当日定损支付量': it.damagePay,
    '当日首跟': it.firstFollow,
    '当日调解': it.mediation,
    '当日结案': it.caseClose,
    '合计工作量': it.totalWorkload
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '工作量')
  XLSX.writeFile(wb, '四川省工作量通报.xlsx')
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
:deep(.el-input__inner) { font-size: 13px; height: 32px; line-height: 32px; border-radius: 6px; }
:deep(.el-button) { font-size: 13px; padding: 6px 14px; height: 32px; line-height: 32px; border-radius: 6px; font-weight: 500; }
:deep(.el-dropdown-menu__item) { padding: 6px 12px; font-size: 13px; }
</style>