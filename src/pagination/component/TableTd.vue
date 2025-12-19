<template>
  <td ref="tdRef" class="td-component" :style="tdStyle" :class="{ 'align-bottom': props.alignBottom }">
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
}>(), {
  widthRatio: 1,
  isEmpty: false,
  alignBottom: false
})

const tdRef = ref<HTMLElement | null>(null)
const componentRefs = ref<any[]>([])
const logger = inject('paginationLogger', null) as any

onBeforeUpdate(() => {
  componentRefs.value = []
})

const tdStyle = computed(() => ({
  width: `${props.widthRatio * 100}%`
}))

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
const trySplit = (pageContext: any, docContext: any) => {
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
      } else {
        // Error
        if (logger) {
          logger.addLog(`Item ${i} returned error code ${result.code}`, 'Td.trySplit', 1)
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
  }

  return {
    code: 1,
    data: [
      {
        type: 'Td',
        data: {
          items: firstPartItems,
          widthRatio: props.widthRatio
        }
      },
      {
        type: 'Td',
        data: {
          items: secondPartItems,
          widthRatio: props.widthRatio
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
}

.td-component.align-bottom {
  vertical-align: bottom;
}
</style>

