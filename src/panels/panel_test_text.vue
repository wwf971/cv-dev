<template>
  <div class="panel-layout">
    <!-- Control Panel (Left) with Tabs -->
    <div class="control-panel">
      <h3>Text Cross-Page Test</h3>
      <p class="description">Test data-driven pagination for text that spans across pages.</p>
      
      <button @click="runPagination" class="control-button">
        Run Pagination
      </button>
      
      <button @click="addMoreText" class="control-button">
        Add More Text
      </button>
      
      <TabsOnTop defaultTab="Info" style="margin-top: 16px; height: 400px;">
        <TabOnTop label="Info">
          <div class="info-panel">
            <h4>Test Info</h4>
            <div class="info-row">
              <span>Doc ID:</span>
              <span>test-text-cross-page</span>
            </div>
            <div class="info-row">
              <span>Components:</span>
              <span>{{ docData.length }}</span>
            </div>
            <div class="info-row">
              <span>Pages:</span>
              <span>{{ pageCount }}</span>
            </div>
            
            <div class="description" style="margin-top: 20px;">
              <strong>How it works:</strong><br/>
              This uses a data-driven approach where:
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>Content is represented as data</li>
                <li>Pagination runs in trials</li>
                <li>Components decide if they need splitting</li>
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
              <Doc docId="test-text-cross-page-original">
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
              docId="test-text-cross-page"
              :pageHeight="1122.24"
              :pagePadding="{ top: 40, bottom: 40, left: 40, right: 40 }"
              :docDataInit="docData"
            />
          </div>
        </TabOnTop>
      </TabsOnTop>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import TabsOnTop from '@wwf971/vue-comp-misc/src/layout/tabs/TabsOnTop.vue'
import { TabOnTop } from '@wwf971/vue-comp-misc/src/layout/tabs/TabsOnTopSlots'
import PageInfo from '@/pagination/PageInfo.vue'
import LogView from '@/pagination/LogView.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import Text from '@/pagination/component/Text.vue'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'Text': Text
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const logs = ref([])
const selectedPageIndex = ref(0)
const contentTabsRef = ref(null)

// Reactive page count
const pageCount = computed(() => {
  return paginationRef.value?.getPageNum() || 0
})

// Reactive current page info
const currentPageInfo = computed(() => {
  if (!paginationRef.value || selectedPageIndex.value < 0) return null
  return paginationRef.value.getPageInfo(selectedPageIndex.value)
})

// Sample doc data
const docData = ref([
  {
    type: 'Text',
    data: {
      content: 'これは日本語のテキストです。'.repeat(100) + 
               '\n\n' +
               'This is English text for testing cross-page pagination. '.repeat(100) +
               '\n\n' +
               'Mixed content with 日本語 and English. '.repeat(50)
    }
  },
  {
    type: 'Text',
    data: {
      content: 'Second paragraph with more content. '.repeat(80)
    }
  }
])

const runPagination = () => {
  if (paginationRef.value) {
    // Switch to Paginated tab using the exposed method
    if (contentTabsRef.value) {
      contentTabsRef.value.switchTab('Paginated')
    }
    
    paginationRef.value.setDocData(docData.value)
    paginationRef.value.runPagination()
    // Update logs after pagination - force reactivity
    setTimeout(() => {
      const newLogs = paginationRef.value.getLogs()
      // console.log('Retrieved logs:', newLogs)
      logs.value = [...newLogs]
    }, 100)
  }
}

const addMoreText = () => {
  docData.value.push({
    type: 'Text',
    data: {
      content: `New text added at ${new Date().toLocaleTimeString()}. `.repeat(50)
    }
  })
  console.log('Added more text, total components:', docData.value.length)
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

const handleChangePageHeight = async (pageIndex, newHeight) => {
  console.log(`Changing page ${pageIndex} height to ${newHeight}`)
  if (paginationRef.value && paginationRef.value.changePageHeight) {
    await paginationRef.value.changePageHeight(pageIndex, newHeight)
    // Refresh logs
    updateLogs()
  }
}

// Debug: watch logs
watch(logs, (newLogs) => {
  console.log('Logs updated:', newLogs.length, 'entries')
}, { deep: true })
</script>

<style scoped>
@import './panelStyles.css';

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

