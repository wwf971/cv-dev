<template>
  <!-- Outer wrapper - full width -->
  <div class="pagination-wrapper" ref="paginationWrapper">
    <!-- Hidden elements for Puppeteer -->
    <div id="pagination-data" style="display: none;"></div>
    <div id="padding-config" style="display: none;" data-padding-top="40" data-padding-bottom="40" data-padding-left="40" data-padding-right="40"></div>
    <button id="export-pagination-data" @click="exportPaginationData" style="display: none;">Export Pagination Data</button>
    
    <!-- Inner wrapper - constrains content and page lines to same width -->
    <div class="content-constrained-wrapper" ref="contentWrapper">
      <!-- Page lines container (positioned relative to content area) -->
      <div class="page-lines-container" ref="pageLinesContainer">
        <PageLine 
          v-for="line in paginationStore.pageLines" 
          :key="`page-line-${line.pageNumber}-${line.type}`"
          :line="line"
        />
      </div>
      
      <!-- Content slot -->
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUpdated } from 'vue'
import { usePaginationStore } from '@/panels/paginationStore.js'
import PageLine from './component_core/PageLine.vue'
import { A4_SIZES } from '@/config.js'

// Define component name
defineOptions({
  name: 'Pagination2'
})

// Store
const paginationStore = usePaginationStore()

// Status ref to track component state
const status = ref('Ready')

// Use store's flag instead of local flag

// Cache stable containerTop to avoid circular dependency
const stableContainerTop = ref(null)

// Refs for the pagination wrapper, content wrapper, and page lines container
const paginationWrapper = ref(null)
const contentWrapper = ref(null)
const pageLinesContainer = ref(null)

// Export pagination data for Puppeteer (standalone function)
const exportPaginationData = () => {
  console.log('exportPaginationData: Starting pagination data export')
  
  const container = document.querySelector('.page_a4_width')
  if (!container) {
    console.error('exportPaginationData: .page_a4_width container not found')
    return
  }
  
  const paginationDataElement = document.getElementById('pagination-data')
  if (!paginationDataElement) {
    console.error('exportPaginationData: pagination-data element not found')
    return
  }
  
  // Use current page lines from store
  const currentPageLines = paginationStore.pageLines
  if (!currentPageLines || currentPageLines.length === 0) {
    console.warn('exportPaginationData: No page lines available in store')
    return
  }
  
  // Export proper page ranges with both begin and end positions
  // Get begin and end lines separately
  const beginLines = currentPageLines
    .filter(line => line.type === 'begin')
    .sort((a, b) => a.pageNumber - b.pageNumber)
    
  const endLines = currentPageLines
    .filter(line => line.type === 'end')
    .sort((a, b) => a.pageNumber - b.pageNumber)
  
  // Create page ranges with explicit begin and end positions
  // Handle cases where pages might have begin lines but no matching end lines
  const pageRangeMap = new Map()
  
  // First, collect all begin lines
  beginLines.forEach(beginLine => {
    pageRangeMap.set(beginLine.pageNumber, {
      pageNumber: beginLine.pageNumber,
      beginY: beginLine.y,
      endY: null, // Will be filled by end line or estimated
      isDashed: false
    })
  })
  
  // Then, match with end lines
  endLines.forEach(endLine => {
    const pageRange = pageRangeMap.get(endLine.pageNumber)
    if (pageRange) {
      pageRange.endY = endLine.y
      pageRange.isDashed = endLine.exceedsContainer || false
    }
  })
  
  // Handle pages with begin lines but no end lines (estimate end position)
  pageRangeMap.forEach((pageRange, pageNumber) => {
    if (pageRange.endY === null) {
      // Estimate end position using effective page height
      const estimatedEndY = pageRange.beginY + paginationStore.config.effectivePageHeight
      
      // Don't create pages that extend significantly beyond actual content
      const maxValidEndY = container.offsetHeight + 100 // Allow small overflow
      
      if (pageRange.beginY >= container.offsetHeight) {
        // Page begins beyond content - this shouldn't happen, skip it
        console.warn(`Page ${pageNumber} begins beyond content (${pageRange.beginY} >= ${container.offsetHeight}), removing`);
        pageRangeMap.delete(pageNumber);
        return;
      }
      
      // Cap at container height but ensure endY > beginY
      const cappedEndY = Math.min(estimatedEndY, maxValidEndY)
      pageRange.endY = Math.max(cappedEndY, pageRange.beginY + 50)
      
      pageRange.isDashed = true // Mark as estimated/problematic
      
      console.warn(`Page ${pageNumber} missing end line, estimated endY: ${pageRange.endY} (container: ${container.offsetHeight})`)
    }
  })
  
  // Convert map to array and sort by page number
  const pageRanges = Array.from(pageRangeMap.values()).sort((a, b) => a.pageNumber - b.pageNumber)
  
  // Add container dimensions and padding configuration
  const containerData = {
    width: container.offsetWidth,
    height: container.offsetHeight,
    paddingTop: paginationStore.config.paddingTop,
    paddingBottom: paginationStore.config.paddingBottom,
    paddingLeft: paginationStore.config.paddingLeft,
    paddingRight: paginationStore.config.paddingRight,
    pageHeight: paginationStore.config.pageHeight,
    effectivePageHeight: paginationStore.config.effectivePageHeight,
    pageGap: paginationStore.config.pageGap,
    algorithm: 'fixed-position',
    pageRanges: pageRanges, // Use proper page ranges with begin/end pairs
    timestamp: new Date().toISOString()
  }
  
  paginationDataElement.textContent = JSON.stringify(containerData)
  
  console.log('exportPaginationData: Successfully exported pagination data:', {
    totalPages: pageRanges.length,
    containerWidth: container.offsetWidth,
    containerHeight: container.offsetHeight,
    algorithm: 'fixed-position',
    timestamp: containerData.timestamp
  })
}

// Dynamic update method exposed to the store
const updatePageLines = async () => {
  console.log('Pagination_2: updatePageLines called')
  paginationStore.addPageLinesToDocEnd()
  
  // Auto-export pagination data after page lines are updated
  setTimeout(() => {
    exportPaginationData()
    console.log('Pagination_2: Auto-exported pagination data after page lines update')
  }, 100)
}

// Lifecycle hooks
onMounted(() => {
  // Expose store to global scope for external access
  window.vue_pagination2_store = paginationStore;
  
  // Get padding configuration from hidden element
  const paddingConfig = document.getElementById('padding-config');
  const paddingTop = ref(paddingConfig ? parseInt(paddingConfig.dataset.paddingTop) : 40)
  const paddingBottom = ref(paddingConfig ? parseInt(paddingConfig.dataset.paddingBottom) : 40)
  const paddingLeft = ref(paddingConfig ? parseInt(paddingConfig.dataset.paddingLeft) : 40)
  const paddingRight = ref(paddingConfig ? parseInt(paddingConfig.dataset.paddingRight) : 40)

  // Set configuration once when component is created
  paginationStore.setConfig({
    paddingTop: paddingTop.value,
    paddingBottom: paddingBottom.value,
    paddingLeft: paddingLeft.value,
    paddingRight: paddingRight.value
  })

  // Register this component with the store
  paginationStore.registerPaginationComponent({
    updatePageLines
  })

  // Initial pagination detection
  setTimeout(() => {
    paginationStore.initPageLines()
    // Auto-export pagination data after initial page lines are created
    setTimeout(() => {
      exportPaginationData()
      console.log('Pagination_2: Auto-exported pagination data after initial setup')
    }, 100)
  }, 200)
  console.warn("Pagination_2.vue: onMounted")
  // DON'T call updatePaginationComponents() here - it will be called from main.vue togglePagination()
})


onUpdated(() => {
  // Skip detection if we're just updating page lines to prevent infinite loops
  if (paginationStore.isUpdatingPageLines) {
    console.log('Pagination_2: Skipping detection - page lines are being updated')
    return
  }
  console.log('Pagination_2: Component updated, re-detecting pagination')
  setTimeout(() => {
    paginationStore.initPageLines()
    // Auto-export pagination data after update
    setTimeout(() => {
      exportPaginationData()
      console.log('Pagination_2: Auto-exported pagination data after component update')
    }, 100)
  }, 100)
})

// Cleanup on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  paginationStore.clearPageLines()
  // Reset all registered components to non-pagination state
  setTimeout(() => {
    registeredComponents.value.forEach(component => {
      if (component && component.paginationOff) {
        component.paginationOff()
      } else if (component && component.updateHeight) {
        // Fallback for components that haven't implemented paginationOff yet
        console.error('Component missing paginationOff method, using updateHeight fallback:', component.componentId)
        component.updateHeight()
      }
    })
  }, 50)
})

// Expose status and exportPaginationData to parent component
defineExpose({
  status,
  exportPaginationData
})
</script>

<style scoped>
.pagination-wrapper {
  /* Outer wrapper - full width, centers content */
  width: 100%;
  display: flex;
  justify-content: left;
  overflow: visible; /* Allow page line labels to overflow */
}

.content-constrained-wrapper {
  /* Inner wrapper - constrains both content and page lines */
  position: relative; /* Create positioning context for page lines */
  width: 100%;
  max-width: v-bind('A4_SIZES.widthInPixels + "px"'); /* A4 width from config */
  overflow: visible; /* Allow page line labels to overflow */
}

.page-lines-container {
  /* Container for page lines, positioned relative to content area */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 9999;
  overflow: visible; /* Allow page line labels to overflow */
}
</style> 