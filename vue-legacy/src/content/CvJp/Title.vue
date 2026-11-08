<template>
  <div ref="titleRef" class="title-component font-cv" :style="titleStyle">
    {{ props.content }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'

const props = withDefaults(defineProps<{
  content: string
  fontSize?: string
  fontWeight?: string | number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  marginBottom?: string
  letterSpacing?: string
}>(), {
  fontSize: '28px',
  fontWeight: '500',
  color: '#000',
  textAlign: 'center',
  marginBottom: '0px',
  letterSpacing: '0.1em'
})

const titleRef = ref<HTMLElement | null>(null)
const logger = inject('paginationLogger', null) as any

const titleStyle = computed(() => ({
  fontSize: props.fontSize,
  fontWeight: props.fontWeight.toString(),
  color: props.color,
  textAlign: props.textAlign,
  marginBottom: props.marginBottom,
  letterSpacing: props.letterSpacing
}))

// trySplit implementation - titles are not splittable, move to next page if doesn't fit
const trySplit = (pageContext: any, docContext: any) => {
  if (!titleRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !titleRef.value ? 'titleRef is null' : !docContext ? 'docContext is null' : 'pageContext is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'Title.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }

  const titleBottom = docContext.measureVerticalPosEnd(titleRef.value)
  const pageBottomY = pageContext.pageBottomY

  // If title fits, no split needed
  if (titleBottom <= pageBottomY) {
    return {
      code: 0,
      data: null
    }
  }

  // Title doesn't fit - move entire title to next page (not splittable)
  if (logger) {
    logger.addLog('Title does not fit, moving to next page', 'Title.trySplit')
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
.title-component {
  width: 100%;
  display: block;
}
</style>

