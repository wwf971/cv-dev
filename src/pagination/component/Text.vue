<template>
  <span ref="textRef" class="text-component">{{ displayText }}</span>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, computed } from 'vue'

const props = defineProps<{
  content: string
  startIndex?: number
  endIndex?: number
  noSplit?: boolean  // If true, text cannot be split and must move to next page
}>()

const textRef = ref<HTMLElement | null>(null)
const logger = inject('paginationLogger', null) as any
const docContext = inject('docContext', null) as any
const pageContext = inject('pageContext', null) as any

const displayText = computed(() => {
  const start = props.startIndex ?? 0
  const end = props.endIndex ?? props.content.length
  return props.content.substring(start, end)
})

onMounted(() => {
  // Text component mounted
})

// Helper functions
const searchLinear = (startIdx: number, endIdx: number, docCtx: any, pageBottomY: number) => {
  if (!textRef.value) return startIdx
  for (let i = startIdx + 1; i <= endIdx; i++) {
    textRef.value.textContent = props.content.substring(startIdx, i)
    const bottom = docCtx.measureVerticalPosEnd(textRef.value)
    if (bottom > pageBottomY) {
      return i - 1
    }
  }
  return endIdx
}

const searchBinary = (startIdx: number, endIdx: number, docCtx: any, pageBottomY: number) => {
  if (!textRef.value) return startIdx
  let left = startIdx
  let right = endIdx
  let result = startIdx
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    textRef.value.textContent = props.content.substring(startIdx, mid)
    const bottom = docCtx.measureVerticalPosEnd(textRef.value)
    
    if (bottom <= pageBottomY) {
      result = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  
  return result
}

// Split function that takes explicit parameters
const trySplit = (pageCtx: any, docCtx: any) => {
  if (!textRef.value || !docCtx || !pageCtx) {
    if (logger) {
      const reason = !textRef.value ? 'textRef is null' : !docCtx ? 'docContext param is null' : 'pageContext param is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'Text.trySplit', 1)
    }
    return {
      code: -1,
      data: null
    }
  }

  const textBottom = docCtx.measureVerticalPosEnd(textRef.value)
  const pageBottomY = pageCtx.pageBottomY
  
  // Safety check: invalid pageBottomY
  if (pageBottomY <= 0) {
    if (logger) {
      logger.addLog(`Error: Invalid pageBottomY=${pageBottomY}. Component not visible?`, 'Text.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }
  
  // If fits in current page, no split needed
  if (textBottom <= pageBottomY) {
    return {
      code: 0,
      data: null
    }
  }
  
  // If noSplit flag is set, return code 2 (not splittable, move to next page)
  if (props.noSplit) {
    if (logger) {
      logger.addLog(`Text doesn't fit and has noSplit flag, moving to next page (code: 2)`, 'Text.trySplit')
    }
    return {
      code: 2,
      data: null
    }
  }
  
  const startIdx = props.startIndex ?? 0
  const endIdx = props.endIndex ?? props.content.length
  
  if (logger) {
    logger.addLog(`Text component needs split. Content: "${props.content.substring(startIdx, endIdx)}", Length: ${endIdx - startIdx} chars`, 'Text.trySplit')
    logger.addLog(`Text bottom: ${textBottom.toFixed(2)}, Page bottom: ${pageBottomY.toFixed(2)}, Overflow: ${(textBottom - pageBottomY).toFixed(2)}px`, 'Text.trySplit')
  }
  
  // Use binary search for better performance
  // For very short text (< 100 chars), linear might be fine
  const useLinear = endIdx - startIdx < 100
  const splitPoint = useLinear
    ? searchLinear(startIdx, endIdx, docCtx, pageBottomY)
    : searchBinary(startIdx, endIdx, docCtx, pageBottomY)
  
  if (logger) {
    logger.addLog(`Search method: ${useLinear ? 'linear' : 'binary'}, Split at: ${splitPoint}`, 'Text.trySplit')
  }
  
  // Restore original text
  textRef.value.textContent = displayText.value
  
  if (splitPoint === startIdx) {
    // Even single character doesn't fit - force split
    if (logger) {
      logger.addLog(`Warning: Even single character doesn't fit, forcing split`, 'Text.trySplit', 1)
    }
    return {
      code: 1,
      data: [
        { 
          type: 'Text', 
          data: {
            content: props.content, 
            startIndex: startIdx, 
            endIndex: startIdx + 1 
          }
        },
        { 
          type: 'Text', 
          data: {
            content: props.content, 
            startIndex: startIdx + 1, 
            endIndex: endIdx 
          }
        }
      ]
    }
  }
  
  return {
    code: 1,
    data: [
      { 
        type: 'Text', 
        data: {
          content: props.content, 
          startIndex: startIdx, 
          endIndex: splitPoint 
        }
      },
      { 
        type: 'Text', 
        data: {
          content: props.content, 
          startIndex: splitPoint, 
          endIndex: endIdx 
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
.text-component {
  display: inline;
}
</style>

