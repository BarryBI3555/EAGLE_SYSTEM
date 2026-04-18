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
          <h4 class="m-0">人员当日工作量统计【统计时间：{{ allOriginData[0]?.maxTjTime }}】</h4>
          <div class="flex gap-2">
            <ElTag v-if="tableError" type="danger">{{ tableError.message }}</ElTag>
            <ElTag v-else-if="loading" type="warning">加载中...</ElTag>
            <ElTag v-else type="success">{{ tableData.length }} 条数据</ElTag>
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

      <ArtTable
        ref="tableRef"
        :loading="loading"
        :pagination="pagination"
        :data="tableData"
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
          <span>{{ $index + 1 + (pagination.current - 1) * pagination.size }}</span>
        </template>

        <!-- 部门列 -->
        <template #comName="{ row }">
          <span>{{ row.comName }}</span>
        </template>

        <!-- 人员列 -->
        <template #userName="{ row }">
          <span>{{ row.userName }}</span>
        </template>

        <!-- 用户编码列 -->
        <template #userCode="{ row }">
          <span>{{ row.userCode }}</span>
        </template>

        <!-- 小组列 -->
        <template #groups="{ row }">
          <span>{{ row.groups }}</span>
        </template>

        <!-- 小组编码列 -->
        <template #groupsCode="{ row }">
          <span>{{ row.groupsCode }}</span>
        </template>

        <!-- 查勘件数量列 -->
        <template #ckJsl="{ row }">
          <span>{{ row.ckJsl }}</span>
        </template>

        <!-- 查勘件未处理数量列 -->
        <template #ckJslWcl="{ row }">
          <span>{{ row.ckJslWcl }}</span>
        </template>

        <!-- 查勘未处理数量列 -->
        <template #ckWcl="{ row }">
          <span>{{ row.ckWcl }}</span>
        </template>

        <!-- 定损提交量列 -->
        <template #dsTjl="{ row }">
          <span>{{ row.dsTjl }}</span>
        </template>

        <!-- 定损未处理量列 -->
        <template #dsWcl="{ row }">
          <span>{{ row.dsWcl }}</span>
        </template>

        <!-- 定损支付量列 -->
        <template #dsZfl="{ row }">
          <span>{{ row.dsZfl }}</span>
        </template>

        <!-- 首跟数量列 -->
        <template #shouGen="{ row }">
          <span>{{ row.shouGen }}</span>
        </template>

        <!-- 后跟数量列 -->
        <template #houGen="{ row }">
          <span>{{ row.houGen }}</span>
        </template>

        <!-- 调解数量列 -->
        <template #tiaoJie="{ row }">
          <span>{{ row.tiaoJie }}</span>
        </template>

        <!-- 结案数量列 -->
        <template #ja="{ row }">
          <span>{{ row.ja }}</span>
        </template>

        <!-- 总量列 -->
        <template #zl="{ row }">
          <span>{{ row.zl }}</span>
        </template>

        <!-- 统计日期列 -->
        <template #tjDate="{ row }">
          <span>{{ row.tjDate }}</span>
        </template>

        <!-- ID列 -->
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

  defineOptions({ name: 'DailyWorkloadTable' })

  // 定义表格数据类型
  interface DailyWorkloadData {
    id: number | null | undefined
    comName: string
    userName: string
    userCode: string
    groups: string
    groupsCode: string | number // 兼容字符串/数字类型的编码
    ckJsl: number
    ckJslWcl: number
    ckWcl: number
    dsTjl: number
    dsWcl: number
    dsZfl: number
    shouGen: number
    houGen: number
    tiaoJie: number
    ja: number
    zl: number
    tjDate: string | null
    maxTjTime: string | null
  }

  // 定义下拉选项类型（新增groupsCode字段用于排序）
  interface GroupOption extends SelectOption {
    groupsCode: string | number
  }
  interface SelectOption {
    label: string
    value: string
  }

  // 定义部门-小组映射类型（值为带groupsCode的小组选项）
  interface DeptGroupMap {
    [deptName: string]: GroupOption[]
  }

  // 定义 useTable 入参和返回值类型
  interface UseTableParams {
    current: number
    size: number
    [key: string]: any
  }
  interface UseTableResult<T> {
    records: T[]
    total: number
    current: number
    size: number
  }

  // 搜索表单 ref
  const searchBarRef = ref<any>(null)

  // 核心：缓存全量数据和映射关系
  const allOriginData = ref<DailyWorkloadData[]>([]) // 全量原始数据
  const fullComOptions = ref<SelectOption[]>([]) // 全量部门选项
  const fullGroupOptions = ref<GroupOption[]>([]) // 全量小组选项（带编码）
  const deptGroupMap = ref<DeptGroupMap>({}) // 部门-小组映射关系 { 部门名: [带编码的小组选项] }

  // ✅ 新增：标记是否已完成初始化（彻底解决时序问题）
  const isInitialized = ref(false)

  // 绑定到下拉框的动态选项
  const comOptions = ref<SelectOption[]>([])
  const groupOptions = ref<SelectOption[]>([]) // 最终渲染的小组选项（仅label/value）

  // 校验规则
  const rules = {
    startDate: [{ required: false, message: '请选择开始日期', trigger: 'change' }],
    endDate: [{ required: false, message: '请选择结束日期', trigger: 'change' }]
  }

  // 🌟 关键修改1：初始日期直接设为当天（不再为空）
  const today = new Date().toISOString().split('T')[0] // 格式化当天日期为 YYYY-MM-DD
  const searchFormState = ref({
    startDate: today, // 初始化=当天
    endDate: today, // 初始化=当天
    comName: '',
    groups: '',
    userName: ''
  })

  // 动态更新的 api 参数
  const tableApiParams = ref({
    current: 1,
    size: 20,
    ...searchFormState.value // 初始api参数也带当天日期
  })

  // 搜索表单配置 - 动态绑定下拉选项
  const searchItems = computed(() => [
    {
      key: 'startDate',
      label: '开始日期',
      type: 'date',
      props: {
        placeholder: '选择开始日期',
        valueFormat: 'YYYY-MM-DD'
      }
    },
    {
      key: 'endDate',
      label: '结束日期',
      type: 'date',
      props: {
        placeholder: '选择结束日期',
        valueFormat: 'YYYY-MM-DD'
      }
    },
    {
      key: 'comName',
      label: '部门',
      type: 'select',
      props: {
        placeholder: '请选择部门',
        options: comOptions.value,
        clearable: true
      }
    },
    {
      key: 'groups',
      label: '小组',
      type: 'select',
      props: {
        placeholder: '请选择小组',
        options: groupOptions.value,
        clearable: true,
        disabled: !searchFormState.value.comName // 未选部门时，小组下拉框禁用
      }
    },
    {
      key: 'userName',
      label: '人员',
      type: 'input',
      props: {
        placeholder: '请输入人员名称'
      }
    }
  ])

  // 表格配置
  const tableConfig = ref({
    height: '100%',
    fixedHeight: false
  })
  const computedTableHeight = computed(() => {
    return tableConfig.value.fixedHeight ? '500px' : ''
  })

  // 工具函数：按groupsCode升序排序小组选项
  const sortGroupByCode = (groups: GroupOption[]) => {
    return groups.sort((a, b) => {
      // 兼容数字/字符串编码排序（如 "001"、1、"02"）
      const codeA = typeof a.groupsCode === 'string' ? parseInt(a.groupsCode) || 0 : a.groupsCode
      const codeB = typeof b.groupsCode === 'string' ? parseInt(b.groupsCode) || 0 : b.groupsCode
      return codeA - codeB
    })
  }

  // 核心：构建部门-小组映射关系 + 全量选项（带排序）
  const buildDeptGroupMap = (data: DailyWorkloadData[]) => {
    if (fullComOptions.value.length > 0 && Object.keys(deptGroupMap.value).length > 0) return

    const comSet = new Set<string>()
    const tempDeptGroupMap: DeptGroupMap = {}

    data.forEach((item) => {
      if (!item.comName || !item.groups || !item.groupsCode) return

      // 收集部门
      comSet.add(item.comName)

      // 构建部门-小组映射（带groupsCode）
      if (!tempDeptGroupMap[item.comName]) {
        tempDeptGroupMap[item.comName] = []
      }
      // 小组去重
      const groupExists = tempDeptGroupMap[item.comName].some((g) => g.value === item.groups)
      if (!groupExists) {
        tempDeptGroupMap[item.comName].push({
          label: item.groups,
          value: item.groups,
          groupsCode: item.groupsCode
        })
      }
    })

    // 缓存全量部门选项
    fullComOptions.value = Array.from(comSet).map((name) => ({ label: name, value: name }))
    comOptions.value = [...fullComOptions.value]

    // 缓存部门-小组映射（并按groupsCode排序）
    Object.keys(tempDeptGroupMap).forEach((dept) => {
      tempDeptGroupMap[dept] = sortGroupByCode(tempDeptGroupMap[dept])
    })
    deptGroupMap.value = tempDeptGroupMap

    // 缓存全量小组选项（所有部门的小组合并去重 + 按编码排序）
    const allGroups: GroupOption[] = []
    Object.values(tempDeptGroupMap).forEach((groups) => {
      groups.forEach((g) => {
        if (!allGroups.some((ag) => ag.value === g.value)) {
          allGroups.push(g)
        }
      })
    })
    fullGroupOptions.value = sortGroupByCode(allGroups)

    // 初始小组选项为空（未选部门时）
    groupOptions.value = []

    ElNotification({
      title: '提示',
      message: `已加载：${fullComOptions.value.length} 个部门，共 ${fullGroupOptions.value.length} 个小组`,
      type: 'success'
    })
  }

  // 核心：监听部门变化，动态更新小组选项（按编码排序）
  watch(
    () => searchFormState.value.comName,
    (newDept, oldDept) => {
      if (newDept) {
        // 选中部门：显示该部门下的小组（已按编码排序），仅保留label/value
        const sortedGroups = deptGroupMap.value[newDept] || []
        groupOptions.value = sortedGroups.map((g) => ({ label: g.label, value: g.value }))
        // 清空之前选中的小组
        searchFormState.value.groups = ''
      } else {
        // 未选部门：清空小组选项，禁用小组下拉框
        groupOptions.value = []
        searchFormState.value.groups = ''
      }
    },
    { immediate: true } // 初始化时执行一次
  )

  // 使用 useTable hook
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
      apiFn: async (params: UseTableParams): Promise<UseTableResult<DailyWorkloadData>> => {
        const queryParams = {
          current: params.current,
          size: params.size,
          startDate: tableApiParams.value.startDate ?? today, // 🌟 兜底为当天
          endDate: tableApiParams.value.endDate ?? today, // 🌟 兜底为当天
          comName: tableApiParams.value.comName ?? '',
          groups: tableApiParams.value.groups ?? '',
          userName: tableApiParams.value.userName ?? ''
        }

        const response = await axios.get('http://localhost:8080/api/cur_gzl/list', {
          params: queryParams
        })

        // ✅ 彻底修复时序：只在【真正第一次加载】且【未初始化】时执行一次
        if (
          !isInitialized.value &&
          response.data?.code === 200 &&
          Array.isArray(response.data.data) &&
          response.data.data.length > 0
        ) {
          allOriginData.value = [...response.data.data]
          buildDeptGroupMap(allOriginData.value)
          isInitialized.value = true // 永久标记：已完成初始化
        }

        // 处理表格数据分页
        let tableResultData: DailyWorkloadData[] = []
        if (response.data?.code === 200 && Array.isArray(response.data.data)) {
          tableResultData = response.data.data as DailyWorkloadData[]
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
          minWidth: 200,
          align: 'center',
          fixed: 'left',
          sortable: true
        },
        { prop: 'userName', label: '人员', width: 120, align: 'center', fixed: 'left' },
        { prop: 'userCode', label: '用户编码', width: 120, align: 'center', sortable: true },
        { prop: 'groups', label: '小组', width: 120, align: 'center', sortable: true },
        { prop: 'groupsCode', label: '小组编码', width: 120, align: 'center', sortable: true },
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
        { prop: 'zl', label: '总量', width: 100, align: 'center', sortable: true },
        { prop: 'tjDate', label: '统计日期', width: 120, align: 'center', sortable: true }
      ]
    },
    performance: {
      enableCache: true,
      cacheTime: 5 * 60 * 1000,
      debounceTime: 300,
      maxCacheSize: 100
    }
  })

  // 表格实例引用
  const tableRef = ref<any>(null)

  // 事件处理函数
  const handleSelectionChange = () => {}
  const handleRowClick = () => {}
  const handleHeaderClick = () => {}
  const handleSortChange = () => {}

  // 手动刷新：重新加载全量数据
  const handleRefresh = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/cur_gzl/list', {
        params: { current: 1, size: 9999 }
      })
      if (res.data?.code === 200 && Array.isArray(res.data.data)) {
        allOriginData.value = [...res.data.data]
        buildDeptGroupMap(allOriginData.value)
      }
      refreshData()
    } catch (err) {
      console.error('刷新失败:', err)
      refreshData()
    }
  }

  const handleSearch = async () => {
    try {
      if (searchBarRef.value) await searchBarRef.value.validate()
      tableApiParams.value = {
        ...tableApiParams.value,
        startDate: searchFormState.value.startDate,
        endDate: searchFormState.value.endDate,
        comName: searchFormState.value.comName,
        groups: searchFormState.value.groups,
        userName: searchFormState.value.userName
      }
      refreshData()
      ElNotification({ title: '提示', message: '搜索成功', type: 'success' })
    } catch (err) {
      ElNotification({ title: '错误', message: '搜索条件校验失败', type: 'error' })
    }
  }

  const handleReset = () => {
    // 🌟 关键修改2：重置后也恢复为当天日期（而非空）
    searchFormState.value = {
      startDate: today,
      endDate: today,
      comName: '',
      groups: '',
      userName: ''
    }
    tableApiParams.value = {
      current: 1,
      size: 20,
      ...searchFormState.value
    }
    refreshData()
  }

  // 导出功能
  const handleExportCurrent = async () => {
    const data = tableData.value as DailyWorkloadData[]
    if (!data.length) {
      ElNotification({ title: '提示', message: '暂无数据可导出', type: 'warning' })
      return
    }
    const exportData = data.map((item, index) => ({
      序号: index + 1,
      部门: item.comName,
      人员: item.userName,
      用户编码: item.userCode,
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
      总量: item.zl,
      统计日期: item.tjDate
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '人员当日工作量统计')
    const fileName = `人员当日工作量统计_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`
    XLSX.writeFile(wb, fileName)
    ElNotification({ title: '成功', message: '导出成功', type: 'success' })
  }

  const handleExportAll = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/cur_gzl/list', {
        params: tableApiParams.value
      })
      const data = res.data?.data as DailyWorkloadData[]
      if (!data.length) {
        ElNotification({ title: '提示', message: '暂无数据可导出', type: 'warning' })
        return
      }
      const exportData = data.map((item, index) => ({
        序号: index + 1,
        部门: item.comName,
        人员: item.userName,
        用户编码: item.userCode,
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
        总量: item.zl,
        统计日期: item.tjDate
      }))
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '人员当日工作量统计')
      const fileName = `人员当日工作量统计_全部_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`
      XLSX.writeFile(wb, fileName)
      ElNotification({ title: '成功', message: `${data.length} 条数据导出成功`, type: 'success' })
    } catch (err) {
      ElNotification({ title: '错误', message: '导出失败', type: 'error' })
    }
  }

  // 页面挂载后强制更新日期筛选器
  onMounted(async () => {
    await nextTick()
    if (searchBarRef.value) {
      searchBarRef.value.$forceUpdate?.()
    }
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
