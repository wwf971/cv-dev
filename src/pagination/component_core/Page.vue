<template>
  <div ref="pageContainerRef" class="page-container" :class="{ 'no-page-lines': props.hidePageLines }" :style="pageStyle">
    <!-- Page begin line (if position is determined) -->
    <PageLine 
      v-if="props.pageStartY !== null && !props.hidePageLines"
      class="print:hidden"
      :line="{
        pageNumber: props.pageIndex + 1,
        type: 'begin',
        y: 0,
        exceedsContainer: false
      }"
    />
    
    <!-- Top padding space -->
    <PagePaddingTop :height="props.padding.top" />
    
    <slot></slot>
    
    <!-- Page end line (if position is determined) -->
    <!-- Position at the very bottom of the page container -->
    <PageLine 
      v-if="props.pageEndY !== null && !props.hidePageLines"
      class="print:hidden"
      :line="{
        pageNumber: props.pageIndex + 1,
        type: 'end',
        y: props.pageHeight,
        exceedsContainer: false
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, onMounted, inject } from 'vue'
import PageLine from './PageLine.vue'
import PagePaddingTop from './PagePaddingTop.vue'
import type { PageContext, PagePadding } from '../pagination'

const props = withDefaults(defineProps<{
  pageIndex: number
  pageStartY: number | null
  pageEndY: number | null
  pageWidth?: number
  pageHeight: number
  padding?: PagePadding
  hidePageLines?: boolean
}>(), {
  padding: () => ({ top: 40, bottom: 40, left: 40, right: 40 }),
  hidePageLines: false
})

const pageContainerRef = ref<HTMLElement | null>(null)

// Get doc context to measure position
const docContext = inject('docContext', null) as any

const pageStyle = computed(() => ({
  // Top padding is now handled by PagePaddingTop component
  paddingBottom: `${props.padding.bottom}px`,
  paddingLeft: `${props.padding.left}px`,
  paddingRight: `${props.padding.right}px`,
  width: props.pageWidth ? `${props.pageWidth}px` : '100%',
  height: `${props.pageHeight}px`,
  boxSizing: 'border-box' as const
}))

// Provide page context to content components
// Use props startY/endY for page context (will be measured and updated by Pagination.vue)
const pageContext = computed<PageContext | null>(() => {
  if (props.pageStartY === null || props.pageEndY === null) {
    return null
  }
  
  // pageBottomY is where content should stop (top edge of bottom padding)
  const pageBottomY = props.pageEndY - props.padding.bottom
  
  return {
    pageIndex: props.pageIndex,
    pageStartY: props.pageStartY,
    pageEndY: props.pageEndY,
    pageBottomY: pageBottomY,
    pageHeight: props.pageHeight,
    padding: props.padding
  }
})

provide('pageContext', pageContext)

// Expose ref and methods for parent component
defineExpose({
  pageContainerRef
})
</script>

<style scoped>
.page-container {
  position: relative;
  background: white;
  border: 1px solid #ddd;
  overflow: visible; /* Allow page lines to be visible */
}

/* Remove border when hidePageLines is true (print preview mode) */
.page-container:has(.no-page-lines) {
  border: none;
}

@media print {
  .page-container {
    border: none;
    height: auto !important;
    min-height: 0 !important;
    page-break-inside: avoid;
  }
}
</style>

