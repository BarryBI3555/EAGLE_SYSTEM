<template>
  <div class="flex flex-col gap-2 pb-3">
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
    <ElCard class="flex-1 art-table-card" style="margin-top: 0;padding: 5px;">
      <template #header>
        <div class="flex-cb">
          <h4 class="m-0">操作日志查询</h4>
          <div class="flex gap-1">
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
        style=""
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
        empty-height="660px"
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

        <!-- 用户名 -->
        <template #username="{ row }">
          <span>{{ row.username || '-' }}</span>
        </template>

        <!-- 用户编码 -->
        <template #usercode="{ row }">
          <span>{{ row.usercode || '-' }}</span>
        </template>

        <!-- 角色 -->
        <template #roles="{ row }">
          <ElTag :type="getRoleInfo(row.roles).type">
            {{ getRoleInfo(row.roles).label }}
          </ElTag>
        </template>

        <!-- 操作描述 -->
        <template #operation="{ row }">
          <span class="operation-text">{{ row.operation || '-' }}</span>
        </template>

        

        <!-- 创建时间 -->
        <template #createTime="{ row }">
          <span>{{ row.createTime || '-' }}</span>
        </template>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Download } from '@element-plus/icons-vue'
  import { ElNotification, ElTag } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import * as XLSX from 'xlsx'
  import request from '@/utils/http'
  import { axiosRequestQueryOperationLogs } from '@/api/AllRequestMethods'
  import { LogService } from '@/services/logServices'

  defineOptions({ name: 'OperationLogTable' })

  /** 操作日志数据类型 */
  interface OperationLogData {
    id: number | null | undefined
    username: string
    usercode: string
    roles: string
    operation: string
    create_time: string
    createTime: string
  }

  /** 角色类型配置 */
  const roleConfig: Record<string, { label: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
    'R_SUPER': { label: '超级管理员', type: 'warning' },
    'R_ADMIN': { label: '管理员', type: 'success' },
    'R_USER': { label: '用户', type: 'info' }
  }

  /** 获取角色显示信息 */
  const getRoleInfo = (role: string) => {
    return roleConfig[role] || { label: role, type: 'info' as const }
  }

  /** 下拉框基础选项类型 */
  interface SelectOption {
    label: string
    value: string
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

  // ==================== 3. 搜索表单配置 ====================
  const rules = {}

  const today = new Date().toISOString().split('T')[0]

  const searchFormState = ref({
    username: '',
    startTime: today,
    endTime: today
  })

  const tableApiParams = ref({
    current: 1,
    size: 20,
    ...searchFormState.value
  })

  const searchItems = computed(() => [
    {
      key: 'username',
      label: '用户名',
      type: 'input',
      props: { placeholder: '请输入用户名' }
    },
    {
      key: 'startTime',
      label: '开始时间',
      type: 'date',
      props: { placeholder: '选择开始时间', valueFormat: 'YYYY-MM-DD' }
    },
    {
      key: 'endTime',
      label: '结束时间',
      type: 'date',
      props: { placeholder: '选择结束时间', valueFormat: 'YYYY-MM-DD' }
    }
  ])

  // ==================== 4. 表格样式与高度 ====================
  const tableConfig = ref({ height: '100%', fixedHeight: false })
  const computedTableHeight = computed(() => (tableConfig.value.fixedHeight ? '660px' : 'calc(100vh - 330px)'))

  // ==================== 5. 表格核心 Hook ====================
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
      apiFn: async (params: UseTableParams): Promise<UseTableResult<OperationLogData>> => {
        const queryParams = {
          page: params.current,
          pageSize: params.size,
          username: tableApiParams.value.username || '',
          startTime: tableApiParams.value.startTime || '',
          endTime: tableApiParams.value.endTime || ''
        }

        const response = await axiosRequestQueryOperationLogs(queryParams)
        
        // request.get 已经提取了 data 字段
        // 后端返回格式: { list: [...], total: number, page: number, pageSize: number }
        let tableResultData: OperationLogData[] = []
        let total = 0
        
        if (response && Array.isArray(response.list)) {
          tableResultData = response.list
          total = response.total || 0
        } else if (Array.isArray(response)) {
          // 如果后端直接返回数组（兼容旧格式）
          tableResultData = response
          total = response.length
        }

        return {
          records: tableResultData,
          total: total,
          current: params.current,
          size: params.size
        }
      },
      apiParams: tableApiParams.value,
      immediate: true,
      columnsFactory: () => [
        {
          prop: 'id',
          label: 'ID',
          width: 80,
          align: 'center',
          fixed: 'left',
          sortable: true
        },
        {
          prop: 'username',
          label: '用户名',
          width: 120,
          align: 'center'
        },
        {
          prop: 'usercode',
          label: '用户编码',
          width: 120,
          align: 'center'
        },
        { 
          prop: 'roles',
          label: '角色',
          width: 150,
          align: 'center',
          useSlot: true,
          slot: 'roles'
        },
        {
          prop: 'operation',
          label: '操作描述',
          minWidth: 300,
          align: 'left'
        },
        { prop: 'createTime',
          label: '操作时间',
          width: 180,
          align: 'center',
          sortable: true
        }
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
    // // 记录刷新日志
    // await LogService.tableLog('操作日志查询', '刷新', tableApiParams.value)
    // refreshData()
  }

  const handleSearch = async () => {
    try {
      if (searchBarRef.value) await searchBarRef.value.validate()
      tableApiParams.value = { ...tableApiParams.value, ...searchFormState.value }
      
      // 记录搜索日志
      await LogService.tableLog('操作日志查询', '搜索', searchFormState.value)
      
      refreshData()
      ElNotification({ title: '提示', message: '搜索成功', type: 'success' })
    } catch {
      ElNotification({ title: '错误', message: '搜索条件校验失败', type: 'error' })
    }
  }

  const handleReset = () => {
    searchFormState.value = {
      username: '',
      startTime: '',
      endTime: ''
    }
    tableApiParams.value = { current: 1, size: 20, ...searchFormState.value }
    refreshData()
  }

  // ==================== 10. 导出功能 ====================
  const handleExportCurrent = async () => {
    const data = tableData.value as OperationLogData[]
    if (!data.length) {
      ElNotification({ title: '提示', message: '暂无数据可导出', type: 'warning' })
      return
    }
    
    // 记录导出日志
    await LogService.tableLog('操作日志查询', '导出当前页', tableApiParams.value)

    const exportData = data.map((item, index) => ({
      序号: index + 1,
      ID: item.id,
      用户名: item.username,
      用户编码: item.usercode,
      角色: item.roles,
      操作描述: item.operation,
      操作时间: item.createTime
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '操作日志')
    const fileName = `操作日志_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`
    XLSX.writeFile(wb, fileName)
    ElNotification({ title: '成功', message: '导出成功', type: 'success' })
  }

  const handleExportAll = async () => {
    try {
      // 记录导出日志
      await LogService.tableLog('操作日志查询', '导出全部', tableApiParams.value)
      
      const queryParams = {
        page: 1,
        pageSize: 99999,
        username: tableApiParams.value.username || '',
        startTime: tableApiParams.value.startTime || '',
        endTime: tableApiParams.value.endTime || ''
      }

      const response = await axiosRequestQueryOperationLogs(queryParams)
      
      const data = response?.list || []
      if (!data.length) {
        ElNotification({ title: '提示', message: '暂无数据可导出', type: 'warning' })
        return
      }

      const exportData = data.map((item, index) => ({
        序号: index + 1,
        ID: item.id,
        用户名: item.username,
        用户编码: item.usercode,
        角色: getRoleInfo(item.roles).label,
        操作描述: item.operation,
        操作时间: item.createTime
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '操作日志')
      const fileName = `操作日志_全部_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`
      XLSX.writeFile(wb, fileName)
      ElNotification({ title: '成功', message: `${data.length} 条数据导出成功`, type: 'success' })
    } catch {
      ElNotification({ title: '错误', message: '导出失败', type: 'error' })
    }
  }
</script>

<style scoped>
.operation-text {
  word-break: break-all;
  max-width: 400px;
  display: inline-block;
}
</style>