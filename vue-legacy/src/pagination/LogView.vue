<template>
  <div class="logs-panel">
    <div class="log-header">
      <h4>Pagination Logs</h4>
      <div class="log-controls">
        <input
          type="text"
          v-model="filterTerm"
          placeholder="Filter by sender..."
          class="filter-input"
        />
        <button v-if="filterTerm" @click="filterTerm = ''" class="clear-filter-btn">×</button>
        <div class="type-filters">
          <label class="type-filter-label">
            <input type="checkbox" v-model="showNormal" />
            <span class="type-badge type-normal">Normal</span>
          </label>
          <label class="type-filter-label">
            <input type="checkbox" v-model="showWarning" />
            <span class="type-badge type-warning">Warning</span>
          </label>
          <label class="type-filter-label">
            <input type="checkbox" v-model="showError" />
            <span class="type-badge type-error">Error</span>
          </label>
        </div>
        <div class="order-controls">
          <button 
            @click="timeOrder = 'latest'" 
            :class="['order-btn', { active: timeOrder === 'latest' }]"
          >
            Latest
          </button>
          <button 
            @click="timeOrder = 'earliest'" 
            :class="['order-btn', { active: timeOrder === 'earliest' }]"
          >
            Earliest
          </button>
          <span class="order-label">first</span>
        </div>
        <button @click="$emit('clear')" class="clear-logs-btn">Clear</button>
      </div>
    </div>
    <div class="log-entries">
      <div 
        v-for="(log, index) in filteredLogs" 
        :key="index"
        class="log-entry"
        :class="getLogTypeClass(log.type)"
      >
        <div class="log-header-line">
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-from">[{{ log.from }}]</span>
          <span class="log-type-badge" :class="getLogTypeBadgeClass(log.type)">
            {{ getLogTypeName(log.type) }}
          </span>
        </div>
        <div class="log-message">{{ log.message }}</div>
      </div>
      <div v-if="logs.length === 0" class="log-empty">
        No logs yet. Click "Run Pagination" to see logs.
      </div>
      <div v-else-if="filteredLogs.length === 0" class="log-empty">
        No logs match filter "{{ filterTerm }}"
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { LogType } from './LogTypes'

const props = defineProps({
  logs: {
    type: Array,
    default: () => []
  }
})

defineEmits(['clear'])

const filterTerm = ref('')
const showNormal = ref(true)
const showWarning = ref(true)
const showError = ref(true)
const timeOrder = ref('latest') // 'latest' or 'earliest'

const filteredLogs = computed(() => {
  let filtered = props.logs
  
  // Filter by sender
  if (filterTerm.value) {
    const term = filterTerm.value.toLowerCase()
    filtered = filtered.filter(log => 
      log.from.toLowerCase().includes(term)
    )
  }
  
  // Filter by type
  filtered = filtered.filter(log => {
    const logType = log.type ?? LogType.Normal
    if (logType === LogType.Normal && !showNormal.value) return false
    if (logType === LogType.Warning && !showWarning.value) return false
    if (logType === LogType.Error && !showError.value) return false
    return true
  })
  
  // Sort by time
  if (timeOrder.value === 'earliest') {
    filtered = [...filtered] // Create copy to avoid mutating original
  } else {
    filtered = [...filtered].reverse() // Latest first
  }
  
  return filtered
})

const getLogTypeName = (type) => {
  const logType = type ?? LogType.Normal
  switch (logType) {
    case LogType.Warning: return 'WARN'
    case LogType.Error: return 'ERR'
    default: return 'INFO'
  }
}

const getLogTypeClass = (type) => {
  const logType = type ?? LogType.Normal
  switch (logType) {
    case LogType.Warning: return 'log-warning'
    case LogType.Error: return 'log-error'
    default: return 'log-normal'
  }
}

const getLogTypeBadgeClass = (type) => {
  const logType = type ?? LogType.Normal
  switch (logType) {
    case LogType.Warning: return 'badge-warning'
    case LogType.Error: return 'badge-error'
    default: return 'badge-normal'
  }
}
</script>

<style scoped>
.logs-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 2px;
}

.log-header h4 {
  margin: 0;
  font-size: 14px;
  color: #333;
  flex-shrink: 0;
}

.log-controls {
  display: flex;
  gap: 4px;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
}

.type-filters {
  display: flex;
  gap: 6px;
  align-items: center;
}

.type-filter-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 11px;
}

.type-filter-label input[type="checkbox"] {
  cursor: pointer;
}

.type-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  font-family: monospace;
}

.type-normal {
  background-color: #4a9eff;
  color: white;
}

.type-warning {
  background-color: #ff9800;
  color: white;
}

.type-error {
  background-color: #f44336;
  color: white;
}

.order-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.order-btn {
  background-color: #666;
}

.order-btn.active {
  background-color: #0066cc;
}

.order-btn:hover {
  background-color: #555;
}

.order-btn.active:hover {
  background-color: #0052a3;
}

.order-label {
  font-size: 10px;
  color: #666;
  font-weight: bold;
}

.filter-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}

.filter-input:focus {
  outline: none;
  border-color: #0066cc;
}

/* Shared button styles */
.clear-filter-btn,
.clear-logs-btn,
.order-btn {
  padding: 2px 8px;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
  font-weight: normal;
}

.clear-filter-btn {
  background-color: #666;
  font-weight: bold;
  line-height: 1;
}

.clear-filter-btn:hover {
  background-color: #555;
}

.clear-logs-btn {
  background-color: #f44336;
}

.clear-logs-btn:hover {
  background-color: #d32f2f;
}

.log-entries {
  flex: 1;
  overflow-y: auto;
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.log-entry {
  display: flex;
  flex-direction: column;
  gap: 0px;
  padding: 2px 0px;
  border-bottom: 1px solid #333;
  color: #d4d4d4;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-header-line {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.log-time {
  color: #858585;
  font-size: 10px;
  flex-shrink: 0;
}

.log-from {
  color: #4ec9b0;
  font-weight: bold;
  font-size: 11px;
  flex-shrink: 0;
}

.log-type-badge {
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 9px;
  font-weight: bold;
  flex-shrink: 0;
}

.badge-normal {
  background-color: #4a9eff;
  color: white;
}

.badge-warning {
  background-color: #ff9800;
  color: white;
}

.badge-error {
  background-color: #f44336;
  color: white;
}

.log-message {
  color: #d4d4d4;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.log-warning .log-message {
  color: #ffcc80;
}

.log-error .log-message {
  color: #ff8a80;
}

.log-empty {
  color: #858585;
  text-align: center;
  padding: 20px;
  font-style: italic;
}
</style>

