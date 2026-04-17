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

            <!-- 导出功能 -->
            <ArtExcelExport
              :data="data as any"
              :columns="exportColumns as any"
              filename="理赔案件周期统计表"
              :auto-index="true"
              button-text="导出"
              @export-success="handleExportSuccess"
            />

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
        <template #investigationCycle="{ row }">
          <span>{{ row.investigationCycle }}天</span>
        </template>

        <!-- 催定周期列 -->
        <template #urgingCycle="{ row }">
          <span>{{ row.urgingCycle }}天</span>
        </template>

        <!-- 定损周期列 -->
        <template #assessmentCycle="{ row }">
          <span>{{ row.assessmentCycle }}天</span>
        </template>

        <!-- 定损完成-支付周期列 -->
        <template #paymentCycle="{ row }">
          <span>{{ row.paymentCycle }}天</span>
        </template>

        <!-- 整体结案周期列 -->
        <template #caseClosureCycle="{ row }">
          <span>{{ row.caseClosureCycle }}天</span>
        </template>

        <!-- 万元内案件结案周期列 -->
        <template #underTenThousandCycle="{ row }">
          <span>{{ row.underTenThousandCycle }}天</span>
        </template>

        <!-- 万元以上案件结案周期列 -->
        <template #overTenThousandCycle="{ row }">
          <span>{{ row.overTenThousandCycle }}天</span>
        </template>

      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue'
  import { useTable, CacheInvalidationStrategy } from '@/hooks/core/useTable'


  defineOptions({ name: 'ClaimsCycleStatisticsTable' })

  // 定义表格数据类型
  interface ClaimsCycleData {
    id: number
    cityCompany: string
    investigationCycle: number
    urgingCycle: number
    assessmentCycle: number
    paymentCycle: number
    caseClosureCycle: number
    underTenThousandCycle: number
    overTenThousandCycle: number
  }

  // 选中的行
  const selectedRows = ref<ClaimsCycleData[]>([])

  // 表格实例引用
  const tableRef = ref()

  // 搜索表单 ref
  const searchBarRef = ref()

  // 校验规则
  const rules = {
    cityCompany: [{ required: false, message: '请输入市公司', trigger: 'blur' }],
  }

  // 表单搜索初始值
  const searchFormState = ref({
    cityCompany: '',
    investigationCycle: '',
    assessmentCycle: '',
    caseClosureCycle: ''
  })

  // 搜索表单配置
  const searchItems = computed(() => [
    {
      key: 'cityCompany',
      label: '市公司',
      type: 'input',
      props: {
        placeholder: '请输入市公司'
      }
    },
    {
      key: 'investigationCycle',
      label: '查勘周期',
      type: 'input',
      props: {
        placeholder: '请输入查勘周期(天)'
      }
    },
    {
      key: 'assessmentCycle',
      label: '定损周期',
      type: 'input',
      props: {
        placeholder: '请输入定损周期(天)'
      }
    },
    {
      key: 'caseClosureCycle',
      label: '整体结案周期',
      type: 'input',
      props: {
        placeholder: '请输入整体结案周期(天)'
      }
    }
  ])

  // 表格配置演示
  const tableConfig = ref({
    height: '100%',
    fixedHeight: false // 新增：是否固定高度的开关
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
    refresh: refreshData,
  } = useTable<ClaimsCycleData>({
    apiFn: async ({ current, size, ...params }) => {
      // 模拟数据 - 在实际项目中替换为真实的API调用
      let mockData: ClaimsCycleData[] = Array.from({ length: 50 }, (_, index) => ({
        id: index + 1,
        cityCompany: `第${index + 1}市公司`,
        investigationCycle: Math.floor(Math.random() * 10) + 1,
        urgingCycle: Math.floor(Math.random() * 5) + 1,
        assessmentCycle: Math.floor(Math.random() * 7) + 1,
        paymentCycle: Math.floor(Math.random() * 5) + 1,
        caseClosureCycle: Math.floor(Math.random() * 20) + 1,
        underTenThousandCycle: Math.floor(Math.random() * 15) + 1,
        overTenThousandCycle: Math.floor(Math.random() * 30) + 1
      }))

      // 根据搜索条件过滤数据
      if (params.cityCompany) {
        mockData = mockData.filter(item => item.cityCompany.includes(params.cityCompany))
      }
      if (params.investigationCycle) {
        mockData = mockData.filter(item => item.investigationCycle.toString().includes(params.investigationCycle))
      }
      if (params.assessmentCycle) {
        mockData = mockData.filter(item => item.assessmentCycle.toString().includes(params.assessmentCycle))
      }
      if (params.caseClosureCycle) {
        mockData = mockData.filter(item => item.caseClosureCycle.toString().includes(params.caseClosureCycle))
      }

      // 分页逻辑
      const start = (current - 1) * size
      const end = start + size
      const paginatedData = mockData.slice(start, end)

      return {
        data: paginatedData,
        total: mockData.length,
        current,
        size
      }
    },
    defaultParams: {
      current: 1,
      size: 20,
      ...searchFormState.value
    },
    cacheTime: 5 * 60 * 1000, // 缓存5分钟
    staleTime: 60 * 1000 // 1分钟后数据被视为陈旧
  })

  // 表格列配置
  const columns = ref([
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
      minWidth: 150,
      align: 'center',
      fixed: 'left'
    },
    {
      prop: 'investigationCycle',
      label: '查勘周期(天)',
      width: 120,
      align: 'center'
    },
    {
      prop: 'urgingCycle',
      label: '催定周期(天)',
      width: 120,
      align: 'center'
    },
    {
      prop: 'assessmentCycle',
      label: '定损周期(天)',
      width: 120,
      align: 'center'
    },
    {
      prop: 'paymentCycle',
      label: '定损完成-支付(天)',
      width: 150,
      align: 'center'
    },
    {
      prop: 'caseClosureCycle',
      label: '整体结案周期(天)',
      width: 140,
      align: 'center'
    },
    {
      prop: 'underTenThousandCycle',
      label: '万元内案件结案周期(天)',
      width: 180,
      align: 'center'
    },
    {
      prop: 'overTenThousandCycle',
      label: '万元以上案件结案周期(天)',
      width: 200,
      align: 'center'
    }
  ])

  // 用于列显示/隐藏的配置
  const columnChecks = ref(
    columns.value.map((col) => ({
      key: col.prop,
      label: col.label,
      visible: true
    }))
  )

  // 导出列配置
  const exportColumns = computed(() => {
    return columns.value.filter(col => col.prop !== 'index')
  })

  // 事件处理函数
  const handleSelectionChange = (rows: ClaimsCycleData[]) => {
    selectedRows.value = rows
  }

  const handleRowClick = (row: ClaimsCycleData) => {
    console.log('Row clicked:', row)
  }

  const handleHeaderClick = (column: any) => {
    console.log('Header clicked:', column)
  }

  const handleSortChange = (sortInfo: any) => {
    console.log('Sort changed:', sortInfo)
  }

  const handleSizeChange = (size: number) => {
    pagination.size = size
    refreshData()
  }

  const handleCurrentChange = (current: number) => {
    pagination.current = current
    refreshData()
  }

  const handleRefresh = () => {
    refreshData()
  }

  const handleSearch = async () => {
    await searchBarRef.value.validate()
    console.log('搜索参数:', searchFormState.value)
    // 更新API参数并重新获取数据
    refreshData()
  }

  const handleReset = () => {
    // 重置搜索表单状态
    searchFormState.value = {
      cityCompany: '',
      investigationCycle: '',
      assessmentCycle: '',
      caseClosureCycle: ''
    }
    refreshData()
  }

  // 操作按钮处理函数
  const handleAdd = () => {
    ElMessage.success('新增记录成功')
    // refreshCreate()
  }

  const handleEdit = (row: ClaimsCycleData) => {
    ElMessage.success(`编辑记录 ${row.cityCompany} 成功`)
    // setTimeout(() => {
    //   refreshUpdate()
    // }, 1000)
  }

  const handleDelete = async (row: ClaimsCycleData) => {
    try {
      await ElMessageBox.confirm(`确定要删除 ${row.cityCompany} 的记录吗？`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })

      ElMessage.success('删除成功')
      // setTimeout(() => {
      //   refreshRemove()
      // }, 1000)
    } catch {
      ElMessage.info('已取消删除')
    }
  }

  const handleView = (row: ClaimsCycleData) => {
    ElMessage.info(`查看记录 ${row.cityCompany}`)
  }

  // 导出功能
  const handleExportSuccess = (filename: string, count: number) => {
    ElMessage.success(`导出 ${count} 条数据成功`)
  }

  // 数据清理
  const handleClearData = () => {
    // clearData()
    ElMessage.info('数据已清空')
  }

  // 刷新策略
  const refreshSoft = () => {
    // refreshSoft()
  }

  const refreshCreate = () => {
    // refreshCreate()
  }

  const refreshUpdate = () => {
    // refreshUpdate()
  }

  const refreshRemove = () => {
    // refreshRemove()
  }
</script>

<style scoped>
  .user-info .el-avatar {
    flex-shrink: 0;
    width: 40px !important;
    height: 40px !important;
  }

  .user-info .el-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

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