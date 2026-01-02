<template>
  <div ref="pageBreakRef" class="page-break-component" :style="{ height: '0px' }"></div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'

const props = defineProps({
  // If true, don't cause page break if this is the first component on the page
  skipIfAtPageTop: {
    type: Boolean,
    default: true
  }
})

const pageBreakRef = ref<HTMLElement | null>(null)
const logger = inject('paginationLogger', null) as any

// trySplit implementation - forces page break unless at page top
const trySplit = (pageContext: any, docContext: any, compIndex?: number) => {
  if (!pageBreakRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !pageBreakRef.value ? 'pageBreakRef is null' : !docContext ? 'docContext is null' : 'pageContext is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'PageBreak.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }

  // Check if PageBreak is the first component on the page and should be skipped
  if (props.skipIfAtPageTop && compIndex === 0) {
    if (logger) {
      logger.addLog('PageBreak is first component on page and skipIfAtPageTop=true, not causing page break', 'PageBreak.trySplit')
    }
    return {
      code: 0, // Component fits (no height, so it doesn't take space)
      data: null
    }
  }

  // Force page break by returning code 2 (move to next page)
  if (logger) {
    logger.addLog('PageBreak forcing content to next page', 'PageBreak.trySplit')
  }

  return {
    code: 2,
    data: null
  }
}

defineExpose({
  trySplit
})
</script>

<style scoped>
.page-break-component {
  width: 100%;
  /* Invisible component with 0 height */
}
</style>
