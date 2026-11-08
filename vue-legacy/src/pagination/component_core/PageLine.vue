<template>
  <div 
    :id="`page-line-${line.pageNumber}-${line.type}`"
    class="page-line no-render"
    :class="`page-line-${line.type}`"
    :style="{ 
      position: 'absolute',
      top: `${line.y}px`,
      left: '0',
      width: 'calc(100% + 15px)', /* Extend 15px beyond content to connect to label */
      height: '2px',
      backgroundColor: line.type === 'begin' ? '#0066cc' : (line.exceedsContainer ? '#ff6600' : '#cc6600'),
      opacity: 0.8,
      zIndex: 9999,
      pointerEvents: 'none',
      borderTop: line.exceedsContainer ? '2px dashed #ff6600' : 'none'
    }"
    :data-page-number="line.pageNumber"
    :data-line-type="line.type"
    :data-y-position="line.y"
  >
    <!-- Debug label (positioned outside content area to the right) -->
    <div class="page-line-label" :style="{
      position: 'absolute',
      left: 'calc(100% - 5px)', /* Position relative to extended line, with slight overlap */
      top: '-18px',
      fontSize: '11px',
      color: 'white',
      backgroundColor: line.type === 'begin' ? '#0066cc' : (line.exceedsContainer ? '#ff6600' : '#cc6600'),
      padding: '2px 6px',
      borderRadius: '3px',
      whiteSpace: 'nowrap',
      fontWeight: 'bold'
    }">
      Page {{ line.pageNumber }} {{ line.type === 'begin' ? 'top' : 'bottom' }} ({{ line.y.toFixed(0) }}px)
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, onMounted, computed } from 'vue'

const props = defineProps<{
  line: {
    pageNumber: number
    type: 'begin' | 'end'
    y: number
    exceedsContainer?: boolean
  }
}>()


// Request extra horizontal space for the label
const spaceManager = inject('paginationSpaceManager', null) as any

// Calculate required space for label
// Label text is approximately: "Page X begin (YYYpx)" = ~20 chars * 6px + padding
const labelWidth = computed(() => {
  const text = `Page ${props.line.pageNumber} ${props.line.type} (${props.line.y.toFixed(0)}px)`
  // Rough estimate: 6.5px per character + 12px padding
  return Math.ceil(text.length * 6.5 + 12)
})

onMounted(() => {
  if (spaceManager) {
    // Request space: line extension (15px) + label width
    const requiredSpace = 15 + labelWidth.value
    spaceManager.applyForExtraHorizontalSpaceRight(`page-line-${props.line.pageNumber}-${props.line.type}`, requiredSpace)
  }
})
</script>

<style scoped>
/* All styles are inline for dynamic values */
</style>
