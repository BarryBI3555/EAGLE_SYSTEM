<template>
  <div class="flex flex-col gap-4 pb-5">
    <!-- 搜索区域 -->
    <ArtSearchBar
      ref="searchBarRef"
      v-model="searchFormState"
      :items="searchItems"
      :rules="rules"
      :is-expand="false"
      :show-expand="true"
      :show-reset-button="true"
      :show-search-button="true"
      :disabled-search-button="false"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 表格区域 -->
    <ElCard class="flex-1 art-table-card" style="margin-top: 0">
      <template #header>
        <div class="flex-cb">
          <h4 class="m-0">四川省周期报表</h4>
          <div class="flex gap-2">
            <ElTag v-if="error" type="danger">{{ error.message }}</ElTag>
            <ElTag v-else-if="loading" type="warning">加载中...</ElTag>
            <ElTag v-else type="success">{{ data.length }} 条数据</ElTag>
          </div>
        </div>
      </template>

      <!-- 表格工具栏 -->
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        @refresh="handleRefresh"
        layout="refresh,size,fullscreen,columns,settings"
        fullClass="art-table-card"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" @click="handleExport" v-ripple>
              <ElIcon>
                <Download />
              </ElIcon>
              导出Excel
            </ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <ArtTable
        ref="tableRef"
        :loading="loading"
        :pagination="pagination"
        :data="data"
        :columns="columns"
        :height="computedTableHeight"
        empty-height="360px"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @header-click="handleHeaderClick"
        @sort-change="handleSortChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <!-- 序号列 -->
        <template #index="{ $index }">
          <span>{{ ($index + 1) + (pagination.current - 1) * pagination.size }}</span>
        </template>

        <!-- 市公司列 -->
        <template #cityCompany="{ row }">
          <span>{{ row.cityCompany }}</span>
        </template>

        <!-- 查勘周期列 -->
        <template #surveyCycle="{ row }">
          <span>{{ row.surveyCycle }}天</span>
        </template>

        <!-- 催定周期列 -->
        <template #urgeDetermineCycle="{ row }">
          <span>{{ row.urgeDetermineCycle }}天</span>
        </template>

        <!-- 定损周期列 -->
        <template #determineCycle="{ row }">
          <span>{{ row.determineCycle }}天</span>
        </template>

        <!-- 定损完成-支付周期列 -->
        <template #determineToPay="{ row }">
          <span>{{ row.determineToPay }}天</span>
        </template>

        <!-- 整体结案周期列 -->
        <template #totalCloseCycle="{ row }">
          <span>{{ row.totalCloseCycle }}天</span>
        </template>

        <!-- 万元内案件结案周期列 -->
        <template #under10kCloseCycle="{ row }">
          <span>{{ row.under10kCloseCycle !== null ? row.under10kCloseCycle + '天' : '-' }}</span>
        </template>

        <!-- 万元以上案件结案周期列 -->
        <template #over10kCloseCycle="{ row }">
          <span>{{ row.over10kCloseCycle !== null ? row.over10kCloseCycle + '天' : '-' }}</span>
        </template>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import {
    Download,
    Refresh
  } from '@element-plus/icons-vue'
  import { ElMessageBox, ElNotification } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import { useTableStore } from '@/store/modules/table'
  import { ColumnOption } from '@/types'
  import * as XLSX from 'xlsx'

  defineOptions({ name: 'PeriodicReportTable' })

  // 定义表格数据类型
  interface PeriodicReportData {
    id: number
    cityCompany: string
    surveyCycle: number
    urgeDetermineCycle: number
    determineCycle: number
    determineToPay: number
    totalCloseCycle: number
    under10kCloseCycle: number | null
    over10kCloseCycle: number | null
  }

  // 搜索表单 ref
  const searchBarRef = ref()

  // 校验规则
  const rules = {
    queryDate: [{ required: false, message: '请选择查询日期', trigger: 'change' }]
  }

  // 表单搜索初始值
  const searchFormState = ref({
    queryDate: new Date().toISOString().split('T')[0],
    cityCompany: ''
  })

  // 搜索表单配置
  const searchItems = computed(() => [
    {
      key: 'queryDate',
      label: '查询日期',
      type: 'date',
      props: {
        placeholder: '选择查询日期',
        valueFormat: 'YYYY-MM-DD'
      }
    },
    {
      key: 'cityCompany',
      label: '市公司',
      type: 'input',
      props: {
        placeholder: '请输入市公司名称'
      }
    }
  ])

  // 表格实例引用
  const tableRef = ref()

  // 表格配置
  const tableConfig = ref({
    height: '100%',
    fixedHeight: false
  })

  // 计算实际的表格高度
  const computedTableHeight = computed(() => {
    return tableConfig.value.fixedHeight ? '500px' : ''
  })

  // 使用 useTable hook 获取表格数据和方法
  const {
    data,
    loading,
    error,
    pagination,
    refreshData,
    handleSizeChange,
    handleCurrentChange
  } = useTable<PeriodicReportData>({
    core: {
      apiFn: async ({ current, size, ...params }) => {
        // 构建查询参数
        const queryParams: Record<string, any> = {
          current,
          size,
          queryDate: params.queryDate || new Date().toISOString().split('T')[0],
          cityCompany: params.cityCompany || ''
        }

        // 发送请求到后端
        const response = await fetch('/api/aaa/list', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(queryParams)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        console.log(result)
        return result
      },
      apiParams: {
        current: 1,
        size: 20,
        ...searchFormState.value
      },
      immediate: true,
      columnsFactory: () => [
        {
          type: 'selection',
          width: 50,
          align: 'center'
        },
        {
          prop: 'index',
          label: '序号',
          width: 80,
          align: 'center',
          fixed: 'left'
        },
        {
          prop: 'cityCompany',
          label: '市公司',
          minWidth: 200,
          align: 'center',
          fixed: 'left'
        },
        {
          prop: 'surveyCycle',
          label: '查勘周期(天)',
          width: 130,
          align: 'center'
        },
        {
          prop: 'urgeDetermineCycle',
          label: '催定周期(天)',
          width: 130,
          align: 'center'
        },
        {
          prop: 'determineCycle',
          label: '定损周期(天)',
          width: 130,
          align: 'center'
        },
        {
          prop: 'determineToPay',
          label: '定损完成-支付(天)',
          width: 160,
          align: 'center'
        },
        {
          prop: 'totalCloseCycle',
          label: '整体结案周期(天)',
          width: 150,
          align: 'center'
        },
        {
          prop: 'under10kCloseCycle',
          label: '万元内案件结案周期(天)',
          width: 180,
          align: 'center'
        },
        {
          prop: 'over10kCloseCycle',
          label: '万元以上案件结案周期(天)',
          width: 180,
          align: 'center'
        }
      ]
    },
    performance: {
      enableCache: true,
      cacheTime: 5 * 60 * 1000, // 缓存5分钟
      debounceTime: 300,
      maxCacheSize: 100
    }
  })

  // 从 useTable 获取列配置和列显示控制
  const { columns, columnChecks } = useTableStore()

  // 选中的行
  const selectedRows = ref<PeriodicReportData[]>([])

  // 事件处理函数
  const handleSelectionChange = (rows: PeriodicReportData[]) => {
    selectedRows.value = rows
  }

  const handleRowClick = (row: PeriodicReportData) => {
    console.log('Row clicked:', row)
  }

  const handleHeaderClick = (column: any) => {
    console.log('Header clicked:', column)
  }

  const handleSortChange = (sortInfo: any) => {
    console.log('Sort changed:', sortInfo)
  }

  const handleRefresh = () => {
    refreshData()
  }

  const handleSearch = async () => {
    await searchBarRef.value.validate()
    console.log('搜索参数:', searchFormState.value)
    refreshData()
  }

  const handleReset = () => {
    // 重置搜索表单状态
    searchFormState.value = {
      queryDate: new Date().toISOString().split('T')[0],
      cityCompany: ''
    }
    refreshData()
  }

  // 导出功能
  const handleExport = () => {
    if (!data.value || data.value.length === 0) {
      ElNotification({
        title: '提示',
        message: '暂无数据可导出',
        type: 'warning'
      })
      return
    }

    const exportData = data.value.map((item, index) => ({
      '序号': index + 1,
      '市公司': item.cityCompany,
      '查勘周期(天)': item.surveyCycle,
      '催定周期(天)': item.urgeDetermineCycle,
      '定损周期(天)': item.determineCycle,
      '定损完成-支付(天)': item.determineToPay,
      '整体结案周期(天)': item.totalCloseCycle,
      '万元内案件结案周期(天)': item.under10kCloseCycle !== null ? item.under10kCloseCycle : '-',
      '万元以上案件结案周期(天)': item.over10kCloseCycle !== null ? item.over10kCloseCycle : '-'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '四川省周期报表')
    
    // 生成当前时间戳格式的文件名 YYYYMMDD_HHMMSS
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    
    const fileName = `四川省周期报表_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`
    XLSX.writeFile(wb, fileName)
    
    ElNotification({
      title: '成功',
      message: '数据导出成功',
      type: 'success'
    })
  }
</script>

<style scoped>
  .custom-header:hover {
    color: var(--el-color-primary-light-3);
  }

  .demo-group .config-toggles .el-switch {
    --el-switch-on-color: var(--el-color-primary);
  }

  .demo-group .performance-info .el-alert {
    --el-alert-padding: 12px;
  }
</style>