<template>
  <div class="panel-layout">
    <!-- Control Panel (Left) with Tabs -->
    <div class="control-panel">
      <h3>BasicInfoJp Test</h3>
      <p class="description">Test data-driven pagination for Japanese resume basic info section.</p>
      
      <button @click="runPagination" class="control-button">
        Run Pagination
      </button>
      
      <button @click="toggleDataMode" class="control-button">
        {{ useExampleData ? 'Use Custom Data' : 'Use Example Data' }}
      </button>
      
      <button @click="fetchRemoteData" class="control-button" :disabled="isFetching">
        {{ isFetching ? 'Fetching...' : 'Fetch Remote Data' }}
      </button>
      
      <TabsOnTop defaultTab="Info" style="margin-top: 16px; height: 400px;">
        <TabOnTop label="Info">
          <div class="info-panel">
            <h4>Test Info</h4>
            <div class="info-row">
              <span>Doc ID:</span>
              <span>test-basic-info-jp</span>
            </div>
            <div class="info-row">
              <span>Components:</span>
              <span>{{ docData.length }}</span>
            </div>
            <div class="info-row">
              <span>Pages:</span>
              <span>{{ pageCount }}</span>
            </div>
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
              BasicInfoJp is not splittable and returns code: 2
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>If fits: stays on current page (code: 0)</li>
                <li>If doesn't fit: moves entirely to next page (code: 2)</li>
                <li>When data prop is null, uses internal example data</li>
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
          </div>
        </TabOnTop>
        
        <TabOnTop label="Pages">
          <div class="pages-panel">
            <div class="page-selector">
              <button 
                v-for="i in pageCount" 
                :key="i"
                @click="selectedPageIndex = i - 1"
                :class="['page-btn', { active: selectedPageIndex === i - 1 }]"
              >
                Page {{ i }}
              </button>
            </div>
            <PageInfo :pageInfo="currentPageInfo" />
          </div>
        </TabOnTop>
        
        <TabOnTop label="Logs">
          <LogView :logs="logs" @clear="clearLogs" />
        </TabOnTop>
      </TabsOnTop>
    </div>

    <!-- Content Panel (Right) with Tabs -->
    <div class="content-panel">
      <TabsOnTop defaultTab="Doc(Original)" ref="contentTabsRef">
        <TabOnTop label="Doc(Original)">
          <div class="doc-content-wrapper">
            <div style="padding: 20px; max-width: 800px;">
              <h3>Original Content (Non-Paginated)</h3>
              <Doc docId="test-basic-info-jp-original">
                <component
                  v-for="(comp, idx) in docData"
                  :key="idx"
                  :is="getComponent(comp.type)"
                  v-bind="comp.data"
                />
              </Doc>
            </div>
          </div>
        </TabOnTop>
        
        <TabOnTop label="Paginated">
          <div class="paginated-content-wrapper">
            <PaginationWrapper 
              ref="paginationRef"
              docId="test-basic-info-jp"
              :pageHeight="PAGE_SIZES.pageHeight"
              :pagePadding="{ top: PAGE_SIZES.paddingTop, bottom: PAGE_SIZES.paddingBottom, left: PAGE_SIZES.paddingLeft, right: PAGE_SIZES.paddingRight }"
            />
          </div>
        </TabOnTop>
      </TabsOnTop>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import TabsOnTop from '@wwf971/vue-comp-misc/src/layout/tabs/TabsOnTop.vue'
import { TabOnTop } from '@wwf971/vue-comp-misc/src/layout/tabs/TabsOnTopSlots'
import PageInfo from '@/pagination/PageInfo.vue'
import LogView from '@/pagination/LogView.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import BasicInfoJp from '@/content/CvJp/BasicInfoJp.vue'
import { fetchRemoteData as _fetchRemoteData } from '@/remote/remoteDataFetcher.js'
import { SERVER_INFO, PAGE_SIZES } from '@/config.js'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'BasicInfoJp': BasicInfoJp
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const logs = ref([])
const selectedPageIndex = ref(0)
const contentTabsRef = ref(null)
const useExampleData = ref(false)
const isFetching = ref(false)

// Reactive page count
const pageCount = computed(() => {
  return paginationRef.value?.getPageNum() || 0
})

// Reactive current page info
const currentPageInfo = computed(() => {
  if (!paginationRef.value || selectedPageIndex.value < 0) return null
  return paginationRef.value.getPageInfo(selectedPageIndex.value)
})

// Original custom data template (with remote patterns - never modified)
const customData = {
  currentDate: '2025年12月19日現在',
  nameFuriganaLast: 'さとう',
  nameFuriganaFirst: 'はなこ',
  nameKanjiLast: '佐藤',
  nameKanjiFirst: '花子',
  birthYearEra: '平成5',
  birthYear: '{{remote:birth/year}}',
  birthMonthDay: '05月15日',
  age: 32,
  gender: 'female',
  postalCode: '〒150-0001',
  address: '東京都渋谷区神宮前1-2-3テストマンション201',
  email: 'hanako.sato@example.com',
  phone: '090-9876-5432',
  photoData: null
}

// Reactive custom data (will be populated with fetched values - this is a working copy)
const customDataReplaced = ref(customData)

// Doc data - with null data to test example data usage
const docData = ref([
  {
    type: 'BasicInfoJp',
    data: null  // Will use example data internally
  }
])

const runPagination = () => {
  if (paginationRef.value) {
    if (contentTabsRef.value) {
      contentTabsRef.value.switchTab('Paginated')
    }
    
    paginationRef.value.setDocData(docData.value)
    paginationRef.value.runPagination()
    
    setTimeout(() => {
      const newLogs = paginationRef.value.getLogs()
      logs.value = [...newLogs]
    }, 100)
  }
}

const fetchRemoteData = async () => {
  useExampleData.value = false
  isFetching.value = true
  
  try {
    const serverOrigin = SERVER_INFO.origin.match(/^https?:\/\//) ? SERVER_INFO.origin : `http://${SERVER_INFO.origin}`
    
    customDataReplaced.value = await _fetchRemoteData(customData, serverOrigin, SERVER_INFO.get_token)
    
    docData.value = [
      {
        type: 'BasicInfoJp',
        data: customDataReplaced.value
      }
    ]
  } catch (error) {
    console.error('[fetchRemoteData] Error:', error)
  } finally {
    isFetching.value = false
  }
}

const toggleDataMode = () => {
  useExampleData.value = !useExampleData.value
  
  docData.value = [
    {
      type: 'BasicInfoJp',
      data: useExampleData.value ? null : customDataReplaced.value
    }
  ]
}

const clearLogs = () => {
  logs.value = []
}

const updateLogs = () => {
  if (paginationRef.value) {
    const newLogs = paginationRef.value.getLogs()
    logs.value = [...newLogs]
  }
}

</script>

<style scoped>
@import './panel_styles.css';

.pages-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-selector {
  display: flex;
  gap: 4px;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.page-btn {
  padding: 4px 12px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  font-weight: normal;
  min-width: 60px;
  box-sizing: border-box;
}

.page-btn:hover {
  background-color: #f9f9f9;
  border-color: #0066cc;
}

.page-btn.active {
  background-color: #0066cc;
  color: white;
  border-color: #0066cc;
  font-weight: bold;
}

.doc-content-wrapper,
.paginated-content-wrapper {
  height: 100%;
  overflow: auto;
}
</style>

