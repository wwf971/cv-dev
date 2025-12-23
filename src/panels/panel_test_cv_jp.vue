<script setup>
// Original custom data template (with remote patterns - never modified)
const customData = {
  basicInfo: {
    currentDate: '2025年12月19日現在',
    nameFuriganaLast: '{{remote:name/jp/furigana/last}}',
    nameFuriganaFirst: '{{remote:name/jp/furigana/first}}',
    nameKanjiLast: '{{remote:name/en/last/upper}}',
    nameKanjiFirst: '{{remote:name/en/first/upper}}',
    birthYear: '{{remote:birth/year}}',
    birthMonth: '{{remote:birth/month}}',
    birthDay: '{{remote:birth/day}}',
    gender: 'male',
    postalCode: '{{remote:address/jp/latest/post-code}}',
    address: '{{remote:address/jp/latest}}',
    email: '{{remote:email/latest}}',
    phone: '{{remote:phone/jp}}',
    photoData: '{{remote:photo/latest}}'
  },
  eduAndWork: {
    // eduEntries: [
    //   { year: 2015, month: 4, value: '〇〇高等学校 入学' },
    //   { year: 2018, month: 3, value: '〇〇高等学校 卒業' },
    //   { year: 2018, month: 4, value: '〇〇大学 〇〇学部 〇〇学科 入学' },
    //   { year: 2022, month: 3, value: '〇〇大学 〇〇学部 〇〇学科 卒業' }
    // ],
    eduEntries: [
      "{{remote:tree:/edu/bachelor/}}",
      "{{remote:tree:/edu/master/}}",
    ],
    // workEntries imported from config.js (overridden by config.0.js if present)
    workEntries: configWorkEntries.length > 0 ? configWorkEntries : [
      { year: 2022, month: 4, value: '株式会社〇〇 入社', note: '現在に至る' }
    ],
    licenseEntries: [
      { year: 2020, month: 6, value: '普通自動車第一種運転免許 取得', note: '' },
      { year: 2021, month: 3, value: 'TOEIC 850点', note: '' }
    ]
  }
}


import { ref, onMounted } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import PanelTest from './panel_test.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import BasicInfoJp from '@/content/CvJp/BasicInfoJp.vue'
import Table from '@/pagination/component/Table.vue'
import VSpace from '@/pagination/component/VSpace.vue'
import { buildEduAndWorkComponents } from '@/content/CvJp/EduAndWorkBuilder'
import { fetchRemoteData as _fetchRemoteData } from '@/remote/remoteDataFetcher.js'
import { SERVER_INFO, PAGE_SIZES, workEntries as configWorkEntries } from '@/config.js'
import { LogType } from '@/pagination/LogTypes'
import { toYearJp, calcAge } from '@/content/CvJp/Utils'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'BasicInfoJp': BasicInfoJp,
    'Table': Table,
    'VSpace': VSpace
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const logs = ref([])
const useExampleData = ref(false)
const isFetching = ref(false)
const fetchError = ref('')

// Single logger that writes to logs array
const logger = {
  addLog: (message, from, type = LogType.Normal) => {
    // Match the timestamp format from Pagination.vue
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const ms = String(now.getMilliseconds()).padStart(2, '0')
    const tzOffset = -now.getTimezoneOffset()
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
    const tzSign = tzOffset >= 0 ? '+' : '-'
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}${ms}${tzSign}${tzHours}`
    
    logs.value.push({
      message,
      from,
      type,
      timestamp
    })
  }
}


// Reactive custom data (will be populated with fetched values - this is a working copy)
const customDataReplaced = ref(customData)

// Example data for EduAndWork
const exampleEduAndWorkData = {
  eduEntries: [
    { year: 2015, month: 4, value: '〇〇高等学校 入学' },
    { year: 2018, month: 3, value: '〇〇高等学校 卒業' },
    { year: 2018, month: 4, value: '〇〇大学 〇〇学部 〇〇学科 入学' },
    { year: 2022, month: 3, value: '〇〇大学 〇〇学部 〇〇学科 卒業' }
  ],
  workEntries: [
    { year: 2022, month: 4, value: '株式会社〇〇〇〇 入社', note: '〇〇部' },
    { year: 2024, month: 6, value: '同社 退職', note: '' }
  ],
  licenseEntries: [
    { year: 2020, month: 3, value: '普通自動車第一種運転免許 取得', note: '' },
    { year: 2021, month: 6, value: 'TOEIC 850点 取得', note: '' }
  ]
}

// Doc data - with null data to test example data usage
const docData = ref([
  {
    type: 'BasicInfoJp',
    data: null  // Will use example data internally
  }
])

// Initialize on mount
onMounted(() => {
  logger.addLog('Initialized with example data', 'panel_test_cv_jp.init', LogType.Normal)
  
  // Build components after logger is ready
  docData.value = [
    {
      type: 'BasicInfoJp',
      data: null
    },
    ...buildEduAndWorkComponents(exampleEduAndWorkData, logger)
  ]
})

/**
 * Process basicInfo data to auto-calculate derived fields
 * - birthYearJp: calculated from birthYear using toYearJp (if not present)
 * - birthMonthDay: formatted from birthMonth and birthDay (if not present)
 * - age: calculated from birthYear, birthMonth, birthDay using calcAge (if not present)
 */
const processBasicInfo = (basicInfo) => {
  if (!basicInfo) return basicInfo
  
  const processed = { ...basicInfo }
  
  // Parse birthYear, birthMonth, birthDay (may be strings or numbers)
  const year = typeof processed.birthYear === 'string' ? parseInt(processed.birthYear) : processed.birthYear
  const month = typeof processed.birthMonth === 'string' ? parseInt(processed.birthMonth) : processed.birthMonth
  const day = typeof processed.birthDay === 'string' ? parseInt(processed.birthDay) : processed.birthDay
  
  // Auto-calculate birthYearJp if not present and we have a valid year
  if (!processed.birthYearJp && year && !isNaN(year)) {
    processed.birthYearJp = toYearJp(year)
  }
  
  // Auto-calculate birthMonthDay if not present and we have valid month/day
  if (!processed.birthMonthDay && month && day && !isNaN(month) && !isNaN(day)) {
    processed.birthMonthDay = `${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`
  }
  
  // Auto-calculate age if not present and we have valid birth date
  if (processed.age === undefined && year && month && day && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
    processed.age = calcAge(year, month, day)
  }
  
  return processed
}

const runPagination = () => {
  if (paginationRef.value) {
    paginationRef.value.setDocData(docData.value)
    paginationRef.value.runPagination()
    
    setTimeout(() => {
      const paginationLogs = paginationRef.value.getLogs()
      // Append pagination logs to existing logs
      logs.value.push(...paginationLogs)
    }, 100)
  }
}

const fetchRemoteData = async () => {
  useExampleData.value = false
  isFetching.value = true
  fetchError.value = '' // Clear previous error
  
  // Clear logs before fetching new data
  logs.value = []
  
  try {
    const serverOrigin = SERVER_INFO.origin.match(/^https?:\/\//) ? SERVER_INFO.origin : `http://${SERVER_INFO.origin}`
    
    // Create timeout promise (10 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fetch timeout after 10 seconds')), 10000)
    })
    
    // Race between fetch and timeout
    customDataReplaced.value = await Promise.race([
      _fetchRemoteData(customData, serverOrigin, SERVER_INFO.get_token),
      timeoutPromise
    ])
    
    logger.addLog('Remote data fetched successfully', 'panel_test_cv_jp.fetchRemoteData', LogType.Normal)
    
    docData.value = [
      {
        type: 'BasicInfoJp',
        data: processBasicInfo(customDataReplaced.value.basicInfo)
      },
      ...buildEduAndWorkComponents(customDataReplaced.value.eduAndWork || {}, logger)
    ]
  } catch (error) {
    console.error('[fetchRemoteData] Error:', error)
    logger.addLog(`Failed to fetch remote data: ${error.message}`, 'panel_test_cv_jp.fetchRemoteData', LogType.Error)
    fetchError.value = error.message
  } finally {
    isFetching.value = false
  }
}

const toggleDataMode = () => {
  useExampleData.value = !useExampleData.value
  
  // Clear logs before rebuilding
  logs.value = []
  
  logger.addLog(
    `Switched to ${useExampleData.value ? 'example' : 'custom'} data mode`, 
    'panel_test_cv_jp.toggleDataMode', 
    LogType.Normal
  )
  
  docData.value = [
    {
      type: 'BasicInfoJp',
      data: useExampleData.value ? null : processBasicInfo(customDataReplaced.value.basicInfo)
    },
    ...buildEduAndWorkComponents(
      useExampleData.value ? exampleEduAndWorkData : (customDataReplaced.value.eduAndWork || {}),
      logger
    )
  ]
}

const clearLogs = () => {
  logs.value = []
}

</script>

<style scoped>
@import './panel_styles.css';

.error-message {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c33;
  font-size: 12px;
  line-height: 1.4;
}
</style>


<template>
  <PanelTest
    title="CV Jp Test"
    description="Test data-driven pagination for Japanese CV components (BasicInfoJp + Education/Work Tables)."
    doc-id="test-cv-jp"
    :pagination-ref="paginationRef"
    :component-count="docData.length"
    :logs="logs"
    @run-pagination="runPagination"
    @clear-logs="clearLogs"
  >
    <template #extra-buttons>
      <button @click="toggleDataMode" class="control-button">
        {{ useExampleData ? 'Use Custom Data' : 'Use Example Data' }}
      </button>
      
      <button @click="fetchRemoteData" class="control-button" :disabled="isFetching">
        {{ isFetching ? 'Fetching...' : 'Fetch Remote Data' }}
      </button>
      
      <div v-if="fetchError" class="error-message">
        {{ fetchError }}
      </div>
    </template>

    <template #extra-info>
      <div class="info-row">
        <span>Data Mode:</span>
        <span>{{ useExampleData ? 'Example (null prop)' : 'Custom' }}</span>
      </div>
      <div class="info-row">
        <span>Fetch Status:</span>
        <span>{{ isFetching ? 'Fetching...' : 'Ready' }}</span>
      </div>
      
      <div class="description" style="margin-top: 20px;">
        <strong>How it works:</strong><br/>
        <strong>BasicInfoJp:</strong> Not splittable (code: 2)
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>If fits: stays on current page (code: 0)</li>
          <li>If doesn't fit: moves entirely to next page (code: 2)</li>
          <li>When data prop is null, uses internal example data</li>
        </ul>
        <strong>Education/Work Tables:</strong> Built using Table/Tr/Td components (code: 1)
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Flattened structure: [Table (Edu+Work), VSpace, Table (License)]</li>
          <li>Each Table can split independently across pages by rows</li>
          <li>VSpace provides smart vertical spacing with split support</li>
          <li>Maintains table structure and styling across page breaks</li>
        </ul>
        
        <strong style="margin-top: 12px; display: block;">Remote Data Fetching:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Click "Use Custom Data" then "Fetch Remote Data" button</li>
          <li>Pattern: <code v-pre>{{remote:path/to/resource}}</code></li>
          <li>Fetches from: <code>serverOrigin/path/to/resource</code></li>
          <li>Supports inline: <code v-pre>Born in {{remote:birth/year}}</code></li>
          <li>Replaces with fetched value or error message</li>
          <li>Original template preserved, replacements in working copy</li>
        </ul>
      </div>
    </template>

    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-cv-jp-original">
          <component
            v-for="(comp, idx) in docData"
            :key="idx"
            :is="getComponent(comp.type)"
            v-bind="comp.data"
          />
        </Doc>
      </div>
    </template>

    <template #content>
      <PaginationWrapper 
        ref="paginationRef"
        docId="test-cv-jp"
        :pageHeight="PAGE_SIZES.pageHeight"
        :pagePadding="{ top: PAGE_SIZES.paddingTop, bottom: PAGE_SIZES.paddingBottom, left: PAGE_SIZES.paddingLeft, right: PAGE_SIZES.paddingRight }"
      />
    </template>
  </PanelTest>
</template>