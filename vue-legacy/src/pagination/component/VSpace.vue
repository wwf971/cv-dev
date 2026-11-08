<template>
  <div ref="vspaceRef" class="vspace-component" :style="{ height: heightInPixels + 'px' }"></div>
</template>

<script setup lang="ts">
import { ref, inject, computed } from 'vue'

const props = defineProps({
  height: [Number, String],
  hiddenIfAtPageTop: {
    type: Boolean,
    default: false
  }
})

// Convert height to number (handle both number and string like '10px')
const heightInPixels = computed(() => {
  if (typeof props.height === 'number') {
    return props.height
  } else if (typeof props.height === 'string') {
    const num = parseFloat(props.height)
    return isNaN(num) ? 0 : num
  }
  return 0
})

const vspaceRef = ref<HTMLElement | null>(null)
const logger = inject('paginationLogger', null) as any

// trySplit implementation
const trySplit = (pageContext: any, docContext: any, compIndex?: number) => {
  if (!vspaceRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !vspaceRef.value ? 'vspaceRef is null' : !docContext ? 'docContext is null' : 'pageContext is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'VSpace.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }

  // Check if VSpace is the first component on the page and should be hidden
  if (props.hiddenIfAtPageTop && compIndex === 0) {
    if (logger) {
      logger.addLog('VSpace is first component on page and hiddenIfAtPageTop=true, moving to next page', 'VSpace.trySplit')
    }
    return {
      code: 2,
      data: null
    }
  }

  const vspaceBottom = docContext.measureVerticalPosEnd(vspaceRef.value)
  const vspaceTop = docContext.measureVerticalPos(vspaceRef.value)
  const pageBottomY = pageContext.pageBottomY

  // If entire vspace fits, no split needed
  if (vspaceBottom <= pageBottomY) {
    return {
      code: 0,
      data: null
    }
  }

  // VSpace doesn't fit - calculate how much space is left
  const spaceLeft = pageBottomY - vspaceTop
  
  if (spaceLeft <= 0) {
    // No space left, move entire component to next page
    if (logger) {
      logger.addLog('No space left for VSpace, moving to next page (code: 2)', 'VSpace.trySplit')
    }
    return {
      code: 2,
      data: null
    }
  }

  // Split: first part fills remaining space, second part is the rest
  const firstHeight = spaceLeft
  const secondHeight = heightInPixels.value - spaceLeft

  if (logger) {
    logger.addLog(`Splitting VSpace: first=${firstHeight}px, second=${secondHeight}px`, 'VSpace.trySplit')
  }

  return {
    code: 1,
    data: [
      {
        type: 'VSpace',
        data: {
          height: firstHeight
        }
      },
      {
        type: 'VSpace',
        data: {
          height: secondHeight
        }
      }
    ]
  }
}

defineExpose({
  trySplit
})
</script>

<style scoped>
.vspace-component {
  width: 100%;
}
</style>

