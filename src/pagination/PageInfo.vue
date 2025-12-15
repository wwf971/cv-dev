<template>
  <div class="page-info-container">
    <div v-if="pageInfo" class="page-info">
      <h4>Page {{ pageInfo.pageNumber }}</h4>
      
      <div class="info-section">
        <div class="info-row">
          <span class="label">Page Index:</span>
          <span class="value">{{ pageInfo.pageIndex }}</span>
        </div>
        <div class="info-row">
          <span class="label">Height:</span>
          <span 
            ref="heightEditRef"
            class="value editable"
            :class="{ editing: isEditingHeight }"
            :contenteditable="isEditingHeight"
            @click="handleHeightClick"
            @blur="finishEditHeight"
            @keydown.enter.prevent="finishEditHeight"
            @keydown.esc.prevent="cancelEditHeight"
            suppressContentEditableWarning
          >{{ isEditingHeight ? heightEditValue : pageInfo.pageHeight }}px</span>
        </div>
        <div class="info-row">
          <span class="label">Start Y:</span>
          <span class="value">{{ pageInfo.pageStartY !== null ? pageInfo.pageStartY.toFixed(2) + 'px' : 'null' }}</span>
        </div>
        <div class="info-row">
          <span class="label">End Y:</span>
          <span class="value">{{ pageInfo.pageEndY !== null ? pageInfo.pageEndY.toFixed(2) + 'px' : 'null' }}</span>
        </div>
        <div class="info-row">
          <span class="label">Bottom Y:</span>
          <span class="value">{{ pageInfo.pageBottomY !== null ? pageInfo.pageBottomY.toFixed(2) + 'px' : 'null' }}</span>
        </div>
      </div>
      
      <div class="info-section">
        <h5>Padding</h5>
        <div class="info-row">
          <span class="label">Top:</span>
          <span class="value">{{ pageInfo.padding.top }}px</span>
        </div>
        <div class="info-row">
          <span class="label">Bottom:</span>
          <span class="value">{{ pageInfo.padding.bottom }}px</span>
        </div>
        <div class="info-row">
          <span class="label">Left:</span>
          <span class="value">{{ pageInfo.padding.left }}px</span>
        </div>
        <div class="info-row">
          <span class="label">Right:</span>
          <span class="value">{{ pageInfo.padding.right }}px</span>
        </div>
      </div>
      
      <div class="info-section">
        <h5>Components ({{ pageInfo.componentCount }})</h5>
        <div v-for="comp in pageInfo.components" :key="comp.index" class="component-item">
          <span class="comp-index">{{ comp.index }}:</span>
          <span class="comp-type">{{ comp.type }}</span>
        </div>
      </div>
    </div>
    <div v-else class="no-page-info">
      No page information available
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  pageInfo: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['changeHeight'])

const isEditingHeight = ref(false)
const heightEditValue = ref('')
const heightEditRef = ref(null)
const originalHeight = ref(0)

const handleHeightClick = (event) => {
  if (isEditingHeight.value || !props.pageInfo) return
  
  // Check if there's an active text selection
  const selection = window.getSelection()
  if (selection && selection.toString().length > 0) {
    return
  }
  
  originalHeight.value = props.pageInfo.pageHeight
  heightEditValue.value = String(props.pageInfo.pageHeight)
  isEditingHeight.value = true
  
  nextTick(() => {
    if (heightEditRef.value) {
      heightEditRef.value.focus()
      // Select all text
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(heightEditRef.value)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  })
}

const finishEditHeight = () => {
  if (!isEditingHeight.value || !heightEditRef.value) return
  
  const text = heightEditRef.value.textContent.replace('px', '').trim()
  const newHeight = parseFloat(text)
  
  if (!isNaN(newHeight) && newHeight > 0 && newHeight !== originalHeight.value) {
    emit('changeHeight', props.pageInfo.pageIndex, newHeight)
  }
  
  isEditingHeight.value = false
}

const cancelEditHeight = () => {
  if (heightEditRef.value) {
    heightEditRef.value.textContent = `${originalHeight.value}px`
  }
  isEditingHeight.value = false
}
</script>

<style scoped>
.page-info-container {
  padding: 8px;
  font-size: 12px;
}

.page-info h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
  border-bottom: 2px solid #0066cc;
  padding-bottom: 4px;
}

.info-section {
  margin-bottom: 16px;
}

.info-section h5 {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: #666;
  font-weight: 600;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row .label {
  color: #666;
  font-weight: 500;
}

.info-row .value {
  color: #333;
  font-family: monospace;
}

.info-row .value.editable {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.2s;
  display: inline-block;
  color: #0066cc;
}

.info-row .value.editable:hover {
  background-color: #e3f2fd;
}

.info-row .value.editable.editing {
  background-color: #fff;
  outline: 2px solid #0066cc;
  outline-offset: -1px;
}

.info-row .value.editable.editing:focus {
  outline: 2px solid #0052a3;
}

.component-item {
  padding: 4px 8px;
  margin: 4px 0;
  background-color: #f5f5f5;
  border-radius: 3px;
  display: flex;
  gap: 8px;
}

.comp-index {
  color: #999;
  font-weight: bold;
}

.comp-type {
  color: #0066cc;
  font-weight: 600;
}

.no-page-info {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px;
}
</style>

