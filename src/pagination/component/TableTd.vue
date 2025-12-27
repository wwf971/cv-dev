<template>
  <td 
    ref="tdRef" 
    :class="['td-component', props.cssClass, { 'align-bottom': props.alignBottom }]" 
    :style="[tdStyle, props.cssStyle]"
    :colspan="props.colspan"
  >
    <component
      v-for="(comp, index) in displayItems"
      :key="index"
      :is="getComponent(comp.type)"
      v-bind="comp.data"
      :ref="(el: any) => { if (el) componentRefs[index] = el }"
    />
  </td>
</template>

<script setup lang="ts">
import { ref, computed, inject, onBeforeUpdate } from 'vue'
import TextList from './TextList.vue'
import Text from './Text.vue'

const props = withDefaults(defineProps<{
  items: any[]
  widthRatio?: number
  isEmpty?: boolean
  alignBottom?: boolean
  colspan?: number
  cssClass?: string
  cssStyle?: any
}>(), {
  widthRatio: 1,
  isEmpty: false,
  alignBottom: false,
  colspan: 1
})

const tdRef = ref<HTMLElement | null>(null)
const componentRefs = ref<any[]>([])
const logger = inject('paginationLogger', null) as any

onBeforeUpdate(() => {
  componentRefs.value = []
})

const tdStyle = computed(() => {
  // If widthRatio is undefined, let the cell auto-fill remaining space
  if (props.widthRatio === undefined) {
    return {}
  }
  return {
    width: `${props.widthRatio * 100}%`
  }
})

const displayItems = computed(() => props.isEmpty ? [] : props.items)

const getComponent = (type: string) => {
  switch (type) {
    case 'Text':
      return Text
    case 'TextList':
      return TextList
    default:
      return null
  }
}

// Split function
const trySplit = (pageContext: any, docContext: any, compIndex?: number) => {
  if (props.isEmpty) {
    // Empty cells don't need splitting
    return {
      code: 0,
      data: null
    }
  }

  if (!tdRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !tdRef.value ? 'tdRef is null' : !docContext ? 'docContext param is null' : 'pageContext param is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'Td.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }

  const tdBottom = docContext.measureVerticalPosEnd(tdRef.value)
  const pageBottomY = pageContext.pageBottomY
  
  // If entire td fits, no split needed
  if (tdBottom <= pageBottomY) {
    return {
      code: 0,
      data: null
    }
  }

  if (logger) {
    logger.addLog(`Td needs split. Items: ${props.items.length}`, 'Td.trySplit')
  }

  // Try to split the content items
  // For simplicity, we'll try to split items similar to TextList logic
  let splitIndex = 0
  let childNeedsSplit = false
  let childSplitData: any = null

  for (let i = 0; i < props.items.length; i++) {
    const comp = componentRefs.value[i]
    if (comp && typeof comp.trySplit === 'function') {
      const result = comp.trySplit(pageContext, docContext)
      
      if (result.code === 1) {
        // This component needs to split
        childNeedsSplit = true
        childSplitData = {
          splitAtIndex: i,
          parts: result.data  // Keep the whole {type, data} structure
        }
        splitIndex = i
        
        if (logger) {
          logger.addLog(`Item ${i} in Td needs split`, 'Td.trySplit')
        }
        break
      } else if (result.code === 0) {
        // This component fits, continue
        splitIndex = i + 1
      } else if (result.code === 2) {
        // This component doesn't fit and is not splittable
        if (logger) {
          logger.addLog(`Item ${i} doesn't fit and is not splittable (code: 2), Td returns code 2`, 'Td.trySplit')
        }
        return {
          code: 2,
          data: null
        }
      } else {
        // Error or unknown code
        if (logger) {
          logger.addLog(`Item ${i} returned error/unknown code ${result.code}`, 'Td.trySplit', 1)
        }
        splitIndex = i + 1
      }
    } else {
      // No trySplit method, assume it fits
      splitIndex = i + 1
    }
  }

  // Create split parts
  let firstPartItems: any[] = []
  let secondPartItems: any[] = []

  if (childNeedsSplit && childSplitData) {
    const splitAtIndex = childSplitData.splitAtIndex
    const parts = childSplitData.parts
    
    firstPartItems = [...props.items.slice(0, splitAtIndex), parts[0]]
    secondPartItems = [parts[1], ...props.items.slice(splitAtIndex + 1)]
  } else {
    firstPartItems = props.items.slice(0, splitIndex)
    secondPartItems = props.items.slice(splitIndex)
  }

  // If second part is empty, no split is actually needed
  if (secondPartItems.length === 0) {
    if (logger) {
      logger.addLog(`All items fit in Td, no split needed`, 'Td.trySplit')
    }
    return {
      code: 0,
      data: null
    }
  }

  if (logger) {
    logger.addLog(`Split Td: first part has ${firstPartItems.length} items, second part has ${secondPartItems.length} items`, 'Td.trySplit')
    firstPartItems.forEach((item, i) => {
      if (item.type === 'Text') {
        const start = item.data.startIndex ?? 0
        const end = item.data.endIndex ?? item.data.content.length
        const text = item.data.content.substring(start, end)
        logger.addLog(`  First part item ${i}: Text "${text}" (${start}-${end})`, 'Td.trySplit')
      }
    })
    secondPartItems.forEach((item, i) => {
      if (item.type === 'Text') {
        const start = item.data.startIndex ?? 0
        const end = item.data.endIndex ?? item.data.content.length
        const text = item.data.content.substring(start, end)
        logger.addLog(`  Second part item ${i}: Text "${text}" (${start}-${end})`, 'Td.trySplit')
      }
    })
  }

  return {
    code: 1,
    data: [
      {
        type: 'Td',
        data: {
          items: firstPartItems,
          widthRatio: props.widthRatio,
          colspan: props.colspan,
          cssClass: props.cssClass,
          cssStyle: props.cssStyle
        }
      },
      {
        type: 'Td',
        data: {
          items: secondPartItems,
          widthRatio: props.widthRatio,
          colspan: props.colspan,
          cssClass: props.cssClass,
          cssStyle: props.cssStyle
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
.td-component {
  border: 1px solid #000;
  padding: 8px;
  vertical-align: top;
  box-sizing: border-box;
}

.td-component.align-bottom {
  vertical-align: bottom;
}

/* Ensure TD respects parent TR height when specified */
tr[style*="height"] .td-component {
  height: inherit;
}
</style>

