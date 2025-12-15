<template>
  <div class="panel-layout">
    <!-- Control Panel (Left) with Tabs -->
    <div class="control-panel">
      <h3>{{ title }}</h3>
      <p class="description">{{ description }}</p>
      
      <button @click="handleRunPagination" class="control-button">
        Run Pagination
      </button>
      
      <slot name="extra-buttons"></slot>
      
      <TabsOnTop defaultTab="Info" style="margin-top: 16px; height: 400px;">
        <TabOnTop label="Info">
          <div class="info-panel">
            <h4>Test Info</h4>
            <div class="info-row">
              <span>Doc ID:</span>
              <span>{{ docId }}</span>
            </div>
            <div class="info-row">
              <span>Components:</span>
              <span>{{ componentCount }}</span>
            </div>
            <div class="info-row">
              <span>Pages:</span>
              <span>{{ pageCount }}</span>
            </div>
            
            <slot name="extra-info"></slot>
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
            <PageInfo 
              :pageInfo="currentPageInfo"
              @changeHeight="handleChangePageHeight"
            />
          </div>
        </TabOnTop>
        
        <TabOnTop label="Logs">
          <LogView :logs="logs" @clear="clearLogs" />
        </TabOnTop>
      </TabsOnTop>
    </div>

    <!-- Content Panel (Right) -->
    <div class="content-panel">
      <slot name="content"></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TabsOnTop from '@wwf971/vue-comp-misc/src/layout/tabs/TabsOnTop.vue'
import { TabOnTop } from '@wwf971/vue-comp-misc/src/layout/tabs/TabsOnTopSlots'
import PageInfo from '@/pagination/PageInfo.vue'
import LogView from '@/pagination/LogView.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  docId: {
    type: String,
    required: true
  },
  paginationRef: {
    type: Object,
    required: false,
    default: null
  },
  componentCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['runPagination'])

const logs = ref([])
const selectedPageIndex = ref(0)

// Reactive page count
const pageCount = computed(() => {
  return props.paginationRef?.getPageNum() || 0
})

// Reactive current page info
const currentPageInfo = computed(() => {
  if (!props.paginationRef || selectedPageIndex.value < 0) return null
  return props.paginationRef.getPageInfo(selectedPageIndex.value)
})

const handleRunPagination = () => {
  emit('runPagination')
  // Update logs after pagination
  setTimeout(() => {
    if (props.paginationRef) {
      const newLogs = props.paginationRef.getLogs()
      logs.value = [...newLogs]
    }
  }, 100)
}

const clearLogs = () => {
  logs.value = []
}

const updateLogs = () => {
  if (props.paginationRef) {
    const newLogs = props.paginationRef.getLogs()
    logs.value = [...newLogs]
  }
}

const handleChangePageHeight = async (pageIndex, newHeight) => {
  if (props.paginationRef && props.paginationRef.changePageHeight) {
    await props.paginationRef.changePageHeight(pageIndex, newHeight)
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
</style>

