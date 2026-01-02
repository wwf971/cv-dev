<template>
  <div ref="textRowRef" class="text-row-component">
    <component
      v-for="(item, index) in visibleItems"
      :key="index"
      :is="getComponent(item.type)"
      v-bind="item.data"
      :ref="(el: any) => { if (el) componentRefs[index] = el }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUpdate, inject } from 'vue'
import Text from './Text.vue'

const props = defineProps<{
  items: any[]  // Array of component configurations
}>()

const textRowRef = ref<HTMLElement | null>(null)
const componentRefs = ref<any[]>([])

// Reset component refs when component updates
onBeforeUpdate(() => {
  componentRefs.value = []
})

// Inject logger from pagination context
const logger = inject('paginationLogger', null) as any

// Component mapping
const getComponent = (type: string) => {
  switch(type) {
    case 'Text':
      return Text
    default:
      return null
  }
}

// Compute visible items (all items initially)
const visibleItems = computed(() => props.items)

onMounted(() => {
  if (logger) {
    logger.addLog('TextRow component mounted', 'TextRow.onMounted')
  }
})

// trySplit implementation for TextRow
const trySplit = (pageContext: any, docContext: any) => {
  if (!textRowRef.value || !docContext || !pageContext) {
    if (logger) {
      logger.addLog('Error - missing refs or contexts', 'TextRow.trySplit', 'Error')
    }
    return {
      code: -1,
      data: null
    }
  }

  if (logger) {
    logger.addLog('Starting split analysis', 'TextRow.trySplit')
  }

  const rowBottom = docContext.measureVerticalPosEnd(textRowRef.value)
  const rowTop = docContext.measureVerticalPos(textRowRef.value)
  const pageBottomY = pageContext.pageBottomY

  if (logger) {
    logger.addLog(`Row top: ${rowTop}, Row bottom: ${rowBottom}, Page bottom: ${pageBottomY}`, 'TextRow.trySplit')
  }

  // Unified loop: check items one by one for split opportunities
  let splitData = null

  if (componentRefs.value && componentRefs.value.length > 0) {
    for (let i = 0; i < componentRefs.value.length; i++) {
      const itemRef = componentRefs.value[i]
      if (itemRef && itemRef.$el) {
        const itemBottom = docContext.measureVerticalPosEnd(itemRef.$el)
        if (logger) {
          logger.addLog(`Item ${i} bottom: ${itemBottom}, Page bottom: ${pageBottomY}`, 'TextRow.trySplit')
        }

        if (itemBottom > pageBottomY) {
          if (logger) {
            logger.addLog(`Item ${i} exceeds page bottom`, 'TextRow.trySplit')
          }

          // Try to split this item internally first
          if (typeof itemRef.trySplit === 'function') {
            const itemSplitResult = itemRef.trySplit(pageContext, docContext)
            if (itemSplitResult && itemSplitResult.code === 1 && itemSplitResult.data) {
              if (logger) {
                logger.addLog(`Item ${i} can be split internally, splitting TextRow at this point`, 'TextRow.trySplit')
              }
              // Split the row at this item, replacing it with the split parts
              const beforeItems = props.items.slice(0, i)
              const afterItems = props.items.slice(i + 1)
              const splitItems = itemSplitResult.data.map((part: any) => part.data)

              splitData = [
                {
                  type: 'TextRow',
                  data: { items: [...beforeItems, ...splitItems] }
                },
                {
                  type: 'TextRow',
                  data: { items: afterItems }
                }
              ]
              break
            }
          }

          // Item exceeds and can't be split internally - split row before this item
          if (logger) {
            logger.addLog(`Item ${i} cannot be split internally, splitting TextRow before it`, 'TextRow.trySplit')
          }
          splitData = [
            {
              type: 'TextRow',
              data: { items: props.items.slice(0, i) }
            },
            {
              type: 'TextRow',
              data: { items: props.items.slice(i) }
            }
          ]
          break
        }
      }
    }
  }

  // If we found a split point, return it
  if (splitData) {
    return {
      code: 1,
      data: splitData
    }
  }

  // If entire row fits, no split needed
  if (rowBottom <= pageBottomY) {
    if (logger) {
      logger.addLog('Entire row fits vertically, no split needed', 'TextRow.trySplit')
    }
    return {
      code: 0,
      data: null
    }
  }

  // Row doesn't fit but no individual items exceed - fall back to boundary splitting
  if (logger) {
    logger.addLog('TextRow needs splitting but no items exceed individually - using boundary split', 'TextRow.trySplit')
  }

  // Try to find a splittable item for boundary split
  let splitIndex = -1
  for (let i = 0; i < props.items.length; i++) {
    const item = props.items[i]
    if (item.type === 'Text' && !item.data.noSplit) {
      splitIndex = i
      if (logger) {
        logger.addLog(`Splitting TextRow at splittable item ${i}: "${item.data.content?.substring(0, 30)}..."`, 'TextRow.trySplit')
      }
      break
    }
  }

  // If no splittable item, split in middle
  if (splitIndex === -1 && props.items.length > 1) {
    splitIndex = Math.ceil(props.items.length / 2)
    if (logger) {
      logger.addLog(`No splittable items found, splitting in middle at ${splitIndex}`, 'TextRow.trySplit')
    }
  }

  // If still no split point, move entire row
  if (splitIndex === -1 || splitIndex >= props.items.length) {
    if (logger) {
      logger.addLog('Cannot split row - moving entire row to next page', 'TextRow.trySplit')
    }
    return {
      code: 2,
      data: null
    }
  }

  const fittingItems = props.items.slice(0, splitIndex)
  const remainingItems = props.items.slice(splitIndex)

  return {
    code: 1,
    data: [
      {
        type: 'TextRow',
        data: { items: fittingItems }
      },
      {
        type: 'TextRow',
        data: { items: remainingItems }
      }
    ]
  }
}

defineExpose({
  trySplit
})
</script>

<style scoped>
.text-row-component {
  display: block;
  width: 100%;
  max-width: 100%;
  line-height: 1;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

:deep(.text-row-component > *) {
  display: inline-block !important;
  white-space: nowrap;
  margin-right: 8px;
}

:deep(.text-row-component > *:last-child) {
  margin-right: 0;
}
</style>
