<template>
  <div class="flex flex-col gap-4 pb-5">
    <!-- 搜索条件区域 -->
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

    <!-- 表格卡片容器 -->
    <ElCard class="flex-1 art-table-card" style="margin-top: 0">
      <template #header>
        <div class="flex-cb">
          <!-- 表格标题 + 动态统计时间 -->
          <h4 class="m-0">小组当日工作量统计【统计时间：{{ currentMaxTjTime }}】</h4>
          <div class="flex gap-2">
            <ElTag v-if="tableError" type="danger">{{ tableError.message }}</ElTag>
            <ElTag v-else-if="loading" type="warning">加载中...</ElTag>
            <ElTag v-else type="success">{{ tableData.length }} 条数据</ElTag>
          </div>
        </div>
      </template>

      <!-- 表格工具栏：刷新、导出、列设置等 -->
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        @refresh="handleRefresh"
        layout="refresh,size,fullscreen,columns,settings"
        fullClass="art-table-card"
      >
        <template #left>
          <ElSpace wrap>
            <!-- 导出按钮：支持当前页 / 全部 -->
            <ElDropdown split-button type="primary" @click="handleExportCurrent" v-ripple>
              <ElIcon>
                <Download />
              </ElIcon>
              导出当前页
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="handleExportCurrent">导出当前页</ElDropdownItem>
                  <ElDropdownItem @click="handleExportAll">导出全部</ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- 主表格 -->
      <ArtTable
        ref="tableRef"
        :loading="loading"
        :pagination="pagination"
        :data="tableData"
        :columns="columns"
        :height="computedTableHeight"
        :scrollbar-always-on="true"
        empty-height="360px"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @header-click="handleHeaderClick"
        @sort-change="handleSortChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <!-- 序号列：自动计算分页序号 -->
        <template #index="{ $index }">
          <span>{{ $index + 1 + (pagination.current - 1) * pagination.size }}</span>
        </template>

        <template #comName="{ row }">
          <span>{{ row.comName }}</span>
        </template>
        <template #groups="{ row }">
          <span>{{ row.groups }}</span>
        </template>
        <template #groupsCode="{ row }">
          <span>{{ row.groupsCode }}</span>
        </template>
        <template #ckJsl="{ row }">
          <span>{{ row.ckJsl }}</span>
        </template>
        <template #ckJslWcl="{ row }">
          <span>{{ row.ckJslWcl }}</span>
        </template>
        <template #ckWcl="{ row }">
          <span>{{ row.ckWcl }}</span>
        </template>
        <template #dsTjl="{ row }">
          <span>{{ row.dsTjl }}</span>
        </template>
        <template #dsWcl="{ row }">
          <span>{{ row.dsWcl }}</span>
        </template>
        <template #dsZfl="{ row }">
          <span>{{ row.dsZfl }}</span>
        </template>
        <template #shouGen="{ row }">
          <span>{{ row.shouGen }}</span>
        </template>
        <template #houGen="{ row }">
          <span>{{ row.houGen }}</span>
        </template>
        <template #tiaoJie="{ row }">
          <span>{{ row.tiaoJie }}</span>
        </template>
        <template #ja="{ row }">
          <span>{{ row.ja }}</span>
        </template>
        <template #zl="{ row }">
          <span>{{ row.zl }}</span>
        </template>

        <!-- ID列：空值安全展示 -->
        <template #id="{ row }">
          <span>{{ row.id !== null && row.id !== undefined ? row.id : '' }}</span>
        </template>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, nextTick, watch } from 'vue'
  import { Download } from '@element-plus/icons-vue'
  import { ElNotification } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import * as XLSX from 'xlsx'
  import axios from 'axios'

  // 组件名称（用于 devtools 调试）
  defineOptions({ name: 'DailyWorkloadGroupTable' })

  // ==================== 1. 类型定义 ====================
  /** 小组每日工作量表格数据类型 */
  interface DailyWorkloadGroupData {
    id: number | null | undefined
    comName: string // 部门
    groups: string // 小组
    groupsCode: string | number // 小组编码
    ckJsl: number // 查勘件数量
    ckJslWcl: number // 查勘件未处理数量
    ckWcl: number // 查勘未处理数量
    dsTjl: number // 定损提交量
    dsWcl: number // 定损未处理量
    dsZfl: number // 定损支付量
    shouGen: number // 首跟数量
    houGen: number // 后跟数量
    tiaoJie: number // 调解数量
    ja: number // 结案数量
    zl: number // 总工作量
    tjDate: string | null // 统计日期
    maxTjTime: string | null // 统计时间（用于标题展示）
  }

  /** 下拉框基础选项类型 */
  interface SelectOption {
    label: string
    value: string
  }

  /** 小组选项类型（扩展编码用于排序） */
  interface GroupOption extends SelectOption {
    groupsCode: string | number
  }

  /** 部门-小组级联映射 */
  interface DeptGroupMap {
    [deptName: string]: GroupOption[]
  }

  /** 表格请求参数类型 */
  interface UseTableParams {
    current: number
    size: number
    [key: string]: any
  }

  /** 表格接口返回结构 */
  interface UseTableResult<T> {
    records: T[]
    total: number
    current: number
    size: number
  }

  // ==================== 2. 引用与状态变量 ====================
  const searchBarRef = ref<any>(null)
  const allOriginData = ref<DailyWorkloadGroupData[]>([])
  const fullComOptions = ref<SelectOption[]>([])
  const fullGroupOptions = ref<GroupOption[]>([])
  const deptGroupMap = ref<DeptGroupMap>({})
  const currentMaxTjTime = ref<string>('')
  const isInitialized = ref(false)
  const comOptions = ref<SelectOption[]>([])
  const groupOptions = ref<SelectOption[]>([])

  // ==================== 3. 搜索表单配置 ====================
  const rules = {
    startDate: [{ required: false, message: '请选择开始日期', trigger: 'change' }],
    endDate: [{ required: false, message: '请选择结束日期', trigger: 'change' }]
  }

  const today = new Date().toISOString().split('T')[0]

  const searchFormState = ref({
    startDate: today,
    endDate: today,
    comName: '',
    groups: ''
  })

  const tableApiParams = ref({
    current: 1,
    size: 20,
    ...searchFormState.value
  })

  const searchItems = computed(() => [
    {
      key: 'startDate',
      label: '开始日期',
      type: 'date',
      props: { placeholder: '选择开始日期', valueFormat: 'YYYY-MM-DD' }
    },
    {
      key: 'endDate',
      label: '结束日期',
      type: 'date',
      props: { placeholder: '选择结束日期', valueFormat: 'YYYY-MM-DD' }
    },
    {
      key: 'comName',
      label: '部门',
      type: 'select',
      props: { placeholder: '请选择部门', options: comOptions.value, clearable: true }
    },
    {
      key: 'groups',
      label: '小组',
      type: 'select',
      props: {
        placeholder: '请选择小组',
        options: groupOptions.value,
        clearable: true,
        disabled: !searchFormState.value.comName
      }
    }
  ])

  // ==================== 4. 表格样式与高度 ====================
  const tableConfig = ref({ height: '100%', fixedHeight: true })
  const computedTableHeight = computed(() => (tableConfig.value.fixedHeight ? '500px' : ''))

  // ==================== 5. 工具函数 ====================
  const sortGroupByCode = (groups: GroupOption[]) => {
    return groups.sort((a, b) => {
      const codeA = typeof a.groupsCode === 'string' ? parseInt(a.groupsCode) || 0 : a.groupsCode
      const codeB = typeof b.groupsCode === 'string' ? parseInt(b.groupsCode) || 0 : b.groupsCode
      return codeA - codeB
    })
  }

  const buildDeptGroupMap = (data: DailyWorkloadGroupData[]) => {
    if (fullComOptions.value.length && Object.keys(deptGroupMap.value).length) return

    const comSet = new Set<string>()
    const tempDeptGroupMap: DeptGroupMap = {}

    data.forEach((item) => {
      if (!item.comName || !item.groups || !item.groupsCode) return
      comSet.add(item.comName)

      if (!tempDeptGroupMap[item.comName]) tempDeptGroupMap[item.comName] = []
      const exists = tempDeptGroupMap[item.comName].some((g) => g.value === item.groups)
      if (!exists) {
        tempDeptGroupMap[item.comName].push({
          label: item.groups,
          value: item.groups,
          groupsCode: item.groupsCode
        })
      }
    })

    fullComOptions.value = Array.from(comSet).map((name) => ({ label: name, value: name }))
    comOptions.value = [...fullComOptions.value]

    Object.keys(tempDeptGroupMap).forEach((dept) => {
      tempDeptGroupMap[dept] = sortGroupByCode(tempDeptGroupMap[dept])
    })
    deptGroupMap.value = tempDeptGroupMap

    const allGroups: GroupOption[] = []
    Object.values(tempDeptGroupMap).forEach((gList) => {
      gList.forEach((g) => {
        if (!allGroups.some((item) => item.value === g.value)) allGroups.push(g)
      })
    })
    fullGroupOptions.value = sortGroupByCode(allGroups)

    ElNotification({
      title: '提示',
      message: `已加载：${fullComOptions.value.length} 个部门，${fullGroupOptions.value.length} 个小组`,
      type: 'success'
    })
  }

  // ==================== 6. 监听：部门切换 → 刷新小组列表 ====================
  watch(
    () => searchFormState.value.comName,
    (newDept) => {
      if (newDept) {
        const sortedGroups = deptGroupMap.value[newDept] || []
        groupOptions.value = sortedGroups.map((g) => ({ label: g.label, value: g.value }))
        searchFormState.value.groups = ''
      } else {
        groupOptions.value = []
        searchFormState.value.groups = ''
      }
    },
    { immediate: true }
  )

  // ==================== 7. 表格核心 Hook ====================
  const {
    data: tableData,
    loading,
    error: tableError,
    pagination,
    refreshData,
    handleSizeChange,
    handleCurrentChange,
    columns,
    columnChecks
  } = useTable({
    core: {
      apiFn: async (params: UseTableParams): Promise<UseTableResult<DailyWorkloadGroupData>> => {
        const queryParams = {
          current: params.current,
          size: params.size,
          startDate: tableApiParams.value.startDate ?? today,
          endDate: tableApiParams.value.endDate ?? today,
          comName: tableApiParams.value.comName ?? '',
          groups: tableApiParams.value.groups ?? ''
        }

        const response = await axios.get('http://localhost:8080/api/cur_gzl_group/list', {
          params: queryParams
        })

        if (!isInitialized.value && response.data?.code === 200 && response.data.data?.length) {
          allOriginData.value = [...response.data.data]
          buildDeptGroupMap(allOriginData.value)
          isInitialized.value = true
        }

        let tableResultData: DailyWorkloadGroupData[] = []
        if (response.data?.code === 200 && Array.isArray(response.data.data)) {
          tableResultData = response.data.data

          if (tableResultData.length) {
            currentMaxTjTime.value = tableResultData[0].maxTjTime || ''
          } else {
            currentMaxTjTime.value = ''
          }
        }

        const start = (params.current - 1) * params.size
        const end = start + params.size
        return {
          records: tableResultData.slice(start, end),
          total: tableResultData.length,
          current: params.current,
          size: params.size
        }
      },
      apiParams: tableApiParams.value,
      immediate: true,
      columnsFactory: () => [
        {
          prop: 'comName',
          label: '部门',
          minWidth: 180,
          align: 'center',
          fixed: 'left',
          sortable: true
        },
        { prop: 'groups', label: '小组', width: 150, align: 'center', sortable: true, fixed: 'left' },
        { prop: 'groupsCode', label: '小组编码', width: 140, align: 'center', sortable: true },
        { prop: 'ckJsl', label: '查勘件数量', width: 120, align: 'center', sortable: true },
        {
          prop: 'ckJslWcl',
          label: '查勘件未处理数量',
          width: 150,
          align: 'center',
          sortable: true
        },
        { prop: 'ckWcl', label: '查勘未处理数量', width: 150, align: 'center', sortable: true },
        { prop: 'dsTjl', label: '定损提交量', width: 120, align: 'center', sortable: true },
        { prop: 'dsWcl', label: '定损未处理量', width: 120, align: 'center', sortable: true },
        { prop: 'dsZfl', label: '定损支付量', width: 120, align: 'center', sortable: true },
        { prop: 'shouGen', label: '首跟数量', width: 100, align: 'center', sortable: true },
        { prop: 'houGen', label: '后跟数量', width: 100, align: 'center', sortable: true },
        { prop: 'tiaoJie', label: '调解数量', width: 100, align: 'center', sortable: true },
        { prop: 'ja', label: '结案数量', width: 100, align: 'center', sortable: true },
        { prop: 'zl', label: '总量', width: 100, align: 'center', sortable: true }
      ]
    },
    performance: {
      enableCache: true,
      cacheTime: 5 * 60 * 1000,
      debounceTime: 300,
      maxCacheSize: 100
    }
  })

  // ==================== 8. 表格事件 ====================
  const tableRef = ref<any>(null)
  const handleSelectionChange = () => {}
  const handleRowClick = () => {}
  const handleHeaderClick = () => {}
  const handleSortChange = () => {}

  // ==================== 9. 页面操作方法 ====================
  const handleRefresh = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/cur_gzl_group/list', {
        params: { current: 1, size: 9999 }
      })
      if (res.data?.code === 200 && res.data.data?.length) {
        allOriginData.value = [...res.data.data]
        buildDeptGroupMap(allOriginData.value)
        currentMaxTjTime.value = res.data.data[0].maxTjTime || ''
      }
      refreshData()
    } catch {
      refreshData()
    }
  }

  const handleSearch = async () => {
    try {
      if (searchBarRef.value) await searchBarRef.value.validate()
      tableApiParams.value = { ...tableApiParams.value, ...searchFormState.value }
      refreshData()
      // ElNotification({ title: '提示', message: '搜索成功', type: 'success' })
    } catch {
      ElNotification({ title: '错误', message: '搜索条件校验失败', type: 'error' })
    }
  }

  const handleReset = () => {
    searchFormState.value = {
      startDate: today,
      endDate: today,
      comName: '',
      groups: ''
    }
    tableApiParams.value = { current: 1, size: 20, ...searchFormState.value }
    refreshData()
  }

  // ==================== 10. 导出功能 ====================
  const handleExportCurrent = async () => {
    const data = tableData.value as DailyWorkloadGroupData[]
    if (!data.length) {
      ElNotification({ title: '提示', message: '暂无数据可导出', type: 'warning' })
      return
    }

    const exportData = data.map((item, index) => ({
      序号: index + 1,
      部门: item.comName,
      小组: item.groups,
      小组编码: item.groupsCode,
      查勘件数量: item.ckJsl,
      查勘件未处理数量: item.ckJslWcl,
      查勘未处理数量: item.ckWcl,
      定损提交量: item.dsTjl,
      定损未处理量: item.dsWcl,
      定损支付量: item.dsZfl,
      首跟数量: item.shouGen,
      后跟数量: item.houGen,
      调解数量: item.tiaoJie,
      结案数量: item.ja,
      总量: item.zl
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '小组当日工作量统计')
    const fileName = `小组当日工作量统计_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`
    XLSX.writeFile(wb, fileName)
    ElNotification({ title: '成功', message: '导出成功', type: 'success' })
  }

  const handleExportAll = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/cur_gzl_group/list', {
        params: tableApiParams.value
      })
      const data = res.data?.data as DailyWorkloadGroupData[]
      if (!data.length) {
        ElNotification({ title: '提示', message: '暂无数据可导出', type: 'warning' })
        return
      }

      const exportData = data.map((item, index) => ({
        序号: index + 1,
        部门: item.comName,
        小组: item.groups,
        小组编码: item.groupsCode,
        查勘件数量: item.ckJsl,
        查勘件未处理数量: item.ckJslWcl,
        查勘未处理数量: item.ckWcl,
        定损提交量: item.dsTjl,
        定损未处理量: item.dsWcl,
        定损支付量: item.dsZfl,
        首跟数量: item.shouGen,
        后跟数量: item.houGen,
        调解数量: item.tiaoJie,
        结案数量: item.ja,
        总量: item.zl
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '小组当日工作量统计')
      const fileName = `小组当日工作量统计_全部_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`
      XLSX.writeFile(wb, fileName)
      ElNotification({ title: '成功', message: `${data.length} 条数据导出成功`, type: 'success' })
    } catch {
      ElNotification({ title: '错误', message: '导出失败', type: 'error' })
    }
  }

  // ==================== 生命周期 ====================
  onMounted(async () => {
    await nextTick()
    if (searchBarRef.value) searchBarRef.value.$forceUpdate?.()
  })
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
