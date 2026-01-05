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
                logger.addLog(`Item ${i} can be split internally (${itemSplitResult.data.length} parts), splitting TextRow at this point`, 'TextRow.trySplit')
              }
              // Split the row at this item, replacing it with the split parts
              const beforeItems = props.items.slice(0, i)
              const afterItems = props.items.slice(i + 1)
              
              // CRITICAL: Extract split parts while preserving ALL properties
              // itemSplitResult.data contains array of component configs like: [{type: 'Text', data: {...}, ...other props}]
              // We MUST keep the entire object intact, not just extract specific properties
              // Array indexing and slice() naturally preserve all properties
              const firstPart = itemSplitResult.data[0]  // Keeps all properties: {type, data, ...}
              const remainingParts = itemSplitResult.data.slice(1)  // Keeps all properties for each item

              // Check if first part is empty Text (no content fits)
              const item = props.items[i]
              if (item.type === 'Text' && 
                  firstPart.data?.startIndex !== undefined && 
                  firstPart.data?.endIndex !== undefined && 
                  firstPart.data.startIndex === firstPart.data.endIndex) {
                if (logger) {
                  logger.addLog(`Item ${i} split but first part is empty (startIndex=${firstPart.data.startIndex}, endIndex=${firstPart.data.endIndex}), splitting before this item instead`, 'TextRow.trySplit')
                }
                // First part is empty - split before this item if possible
                if (i === 0) {
                  // First item and no content fits - move entire row
                  if (logger) {
                    logger.addLog('First item, moving entire row to next page', 'TextRow.trySplit')
                  }
                  return {
                    code: 2,
                    data: null
                  }
                }
                // Split before this item
                splitData = [
                  {
                    type: 'TextRow',
                    data: { items: beforeItems }
                  },
                  {
                    type: 'TextRow',
                    data: { items: props.items.slice(i) }
                  }
                ]
                break
              }

              // Create split result: spread operators preserve all item properties
              splitData = [
                {
                  type: 'TextRow',
                  data: { items: [...beforeItems, firstPart] }  // Spread preserves all properties
                },
                {
                  type: 'TextRow',
                  data: { items: [...remainingParts, ...afterItems] }  // Spread preserves all properties
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

  // Row doesn't fit but no individual items exceed - check with the items themselves
  if (logger) {
    logger.addLog('Row bottom exceeds but no items detected exceeding - checking with items directly', 'TextRow.trySplit')
  }
  
  // Check if any item thinks it needs to split
  for (let i = 0; i < props.items.length; i++) {
    const item = props.items[i]
    const itemRef = componentRefs.value[i]
    
    if (itemRef && typeof itemRef.trySplit === 'function') {
      if (logger) {
        logger.addLog(`Asking item ${i} (type: ${item.type}) if it needs to split`, 'TextRow.trySplit')
      }
      
      const itemSplitResult = itemRef.trySplit(pageContext, docContext)
      
      if (logger) {
        logger.addLog(`Item ${i} trySplit returned code: ${itemSplitResult?.code}`, 'TextRow.trySplit')
      }
      
      // If item says it needs to split (code 1), handle it
      if (itemSplitResult && itemSplitResult.code === 1 && itemSplitResult.data) {
        const beforeItems = props.items.slice(0, i)
        const afterItems = props.items.slice(i + 1)
        
        // CRITICAL: Extract split parts while preserving ALL properties
        // itemSplitResult.data contains array of component configs like: [{type: 'Text', data: {...}, ...other props}]
        // We MUST keep the entire object intact, not just extract specific properties
        // Array indexing and slice() naturally preserve all properties
        const firstPart = itemSplitResult.data[0]  // Keeps all properties: {type, data, ...}
        const remainingParts = itemSplitResult.data.slice(1)  // Keeps all properties for each item
        
        // Check if first part is empty Text (startIndex === endIndex means no characters)
        if (item.type === 'Text' && 
            firstPart.data?.startIndex !== undefined && 
            firstPart.data?.endIndex !== undefined && 
            firstPart.data.startIndex === firstPart.data.endIndex) {
          if (logger) {
            logger.addLog(`Item ${i} split but first part is empty (startIndex=${firstPart.data.startIndex}, endIndex=${firstPart.data.endIndex}), moving entire TextRow to next page`, 'TextRow.trySplit')
          }
          // First part is empty - move entire row to next page
          return {
            code: 2,
            data: null
          }
        }
        
        if (logger) {
          logger.addLog(`Item ${i} split into ${1 + remainingParts.length} parts, applying to TextRow`, 'TextRow.trySplit')
        }
        
        // Create split result: spread operators preserve all item properties
        return {
          code: 1,
          data: [
            {
              type: 'TextRow',
              data: { items: [...beforeItems, firstPart] }  // Spread preserves all properties
            },
            {
              type: 'TextRow',
              data: { items: [...remainingParts, ...afterItems] }  // Spread preserves all properties
            }
          ]
        }
      }
      
      // If item says it fits (code 0), trust it
      if (itemSplitResult && itemSplitResult.code === 0) {
        const discrepancy = rowBottom - pageBottomY
        if (discrepancy > 10) {
          if (logger) {
            logger.addLog(`WARNING: Item says it fits but TextRow exceeds by ${discrepancy.toFixed(2)}px - large discrepancy!`, 'TextRow.trySplit', 'Warning')
          }
        } else {
          if (logger) {
            logger.addLog(`Item says it fits, trusting it (TextRow exceeds by only ${discrepancy.toFixed(2)}px, likely spacing)`, 'TextRow.trySplit')
          }
        }
        return {
          code: 0,
          data: null
        }
      }
    }
  }
  
  // No items could be checked or all returned code 2 (not splittable)
  if (logger) {
    logger.addLog('No items could help with split decision, moving entire row to next page', 'TextRow.trySplit')
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
.text-row-component {
  display: block;
  width: 100%;
  max-width: 100%;
  line-height: 1.2;
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
