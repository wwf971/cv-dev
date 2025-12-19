<template>
  <div ref="textListRef" class="text-list-component">
    <div v-for="(item, index) in displayItems" :key="index" class="list-item">
      <span 
        v-if="shouldShowBullet(index)" 
        class="bullet" 
        :class="{ invisible: isInvisibleBullet(index) }"
      >
        {{ getBullet(index) }}
      </span>
      <Text 
        v-bind="item" 
        :ref="(el: any) => { if (el) textComponentRefs[index] = el }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onBeforeUpdate } from 'vue'
import Text from './Text.vue'

const props = withDefaults(defineProps<{
  mode?: 'ordered' | 'unordered' | 'paragraph'
  items: any[] // List of Text component data
  startBulletNumber?: number
  isSplit?: boolean
  isFirstSplit?: boolean
  isFirstChildSplit?: boolean
}>(), {
  mode: 'unordered',
  startBulletNumber: 1,
  isSplit: false,
  isFirstSplit: false,
  isFirstChildSplit: false
})

const textListRef = ref<HTMLElement | null>(null)
const textComponentRefs = ref<any[]>([])
const logger = inject('paginationLogger', null) as any

onBeforeUpdate(() => {
  textComponentRefs.value = []
})

const displayItems = computed(() => props.items)

const shouldShowBullet = (index: number) => {
  // Don't show bullet for first item if it's a split continuation and first child is also split
  if (index === 0 && props.isSplit && !props.isFirstSplit && props.isFirstChildSplit) {
    return true // Show invisible bullet as placeholder
  }
  return true
}

const isInvisibleBullet = (index: number) => {
  // First item's bullet is invisible if it's continuation of split child
  return index === 0 && props.isSplit && !props.isFirstSplit && props.isFirstChildSplit
}

const getBullet = (index: number) => {
  const bulletIndex = props.startBulletNumber + index
  
  if (props.mode === 'ordered') {
    return `${bulletIndex}.`
  } else if (props.mode === 'unordered') {
    return '•'
  } else { // paragraph
    return '¶'
  }
}

// Pure function for splitting
const trySplit = (pageContext: any, docContext: any) => {
  if (!textListRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !textListRef.value ? 'textListRef is null' : !docContext ? 'docContext param is null' : 'pageContext param is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'TextList.trySplit', 1)
    }
    return {
      code: -1,
      data: null
    }
  }

  const listBottom = docContext.measureVerticalPosEnd(textListRef.value)
  const pageBottomY = pageContext.pageBottomY
  
  // Safety check: invalid pageBottomY
  if (pageBottomY <= 0) {
    if (logger) {
      logger.addLog(`Error: Invalid pageBottomY=${pageBottomY}. Component not visible?`, 'TextList.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }
  
  // If entire list fits, no split needed
  if (listBottom <= pageBottomY) {
    return {
      code: 0,
      data: null
    }
  }

  // Need to split - find which child to split at
  if (logger) {
    logger.addLog(`TextList needs split. Items: ${props.items.length}`, 'TextList.trySplit')
  }

  // Measure each .list-item to find where overflow occurs
  const listItems = textListRef.value.querySelectorAll('.list-item')
  let splitIndex = 0
  let childNeedsSplit = false
  let childSplitData: any = null
  
  if (logger) {
    logger.addLog(`Checking ${listItems.length} list items`, 'TextList.trySplit')
  }

  for (let i = 0; i < listItems.length; i++) {
    const itemBottom = docContext.measureVerticalPosEnd(listItems[i])
    
    if (logger) {
      logger.addLog(`Item ${i} bottom: ${itemBottom.toFixed(2)}, pageBottomY: ${pageBottomY.toFixed(2)}`, 'TextList.trySplit')
    }
    
    if (itemBottom > pageBottomY) {
      // This item overflows - try to split it
      splitIndex = i
      
      if (logger) {
        logger.addLog(`Item ${i} overflows, attempting to split the Text component`, 'TextList.trySplit')
      }
      
      // Get the Text component instance for this item
      const textComponent = textComponentRefs.value[i]
      if (textComponent && typeof textComponent.trySplit === 'function') {
        if (logger) {
          logger.addLog(`Calling trySplit on Text component at index ${i}`, 'TextList.trySplit')
        }
        
        const textSplitResult = textComponent.trySplit(pageContext, docContext)
        
        if (textSplitResult.code === 1 && textSplitResult.data) {
          childNeedsSplit = true
          childSplitData = {
            splitAtIndex: i,
            parts: textSplitResult.data.map((part: any) => part.data)
          }
          
          if (logger) {
            logger.addLog(`Text split successful at item ${i}: ${childSplitData.parts[0].endIndex} chars in first part`, 'TextList.trySplit')
          }
        } else {
          if (logger) {
            logger.addLog(`Text split failed or returned code ${textSplitResult.code}, moving entire item to next page`, 'TextList.trySplit', 1)
          }
        }
      } else {
        if (logger) {
          logger.addLog(`Warning: Text component ref not found or trySplit not available at index ${i}`, 'TextList.trySplit', 1)
        }
      }
      
      break
    } else {
      // This item fits, continue to next
      splitIndex = i + 1
    }
  }

  if (splitIndex === 0) {
    // Even first character of first item doesn't fit - force split
    if (logger) {
      logger.addLog(`Warning: Cannot fit anything, forcing split`, 'TextList.trySplit', 1)
    }
    splitIndex = 1
  }

  // Create split parts
  let firstPartItems: any[] = []
  let secondPartItems: any[] = []
  let secondPartStartBullet = props.startBulletNumber + splitIndex
  let isFirstChildSplit = false
  let isSecondChildSplit = false
  
  if (childNeedsSplit && childSplitData) {
    // A child Text component was split
    const splitAtIndex = childSplitData.splitAtIndex
    const parts = childSplitData.parts
    
    // Items before the split item
    const itemsBefore = props.items.slice(0, splitAtIndex)
    // Items after the split item
    const itemsAfter = props.items.slice(splitAtIndex + 1)
    
    // First part: items before + first part of split item
    firstPartItems = [...itemsBefore, parts[0]]
    // Second part: second part of split item + items after
    secondPartItems = [parts[1], ...itemsAfter]
    
    // Bullet number for second part starts from the split item's bullet
    secondPartStartBullet = props.startBulletNumber + splitAtIndex
    
    // Track if first item in each part is a split
    // Inherit existing isFirstChildSplit, or set it if we're splitting at index 0
    isFirstChildSplit = props.isFirstChildSplit || (splitAtIndex === 0)
    isSecondChildSplit = true // First item of second part is always split (it's the second half)
    
    if (logger) {
      logger.addLog(`Split at item ${splitAtIndex}: first part has ${firstPartItems.length} items, second part has ${secondPartItems.length} items`, 'TextList.trySplit')
    }
  } else {
    // Normal split between items (no Text split)
    firstPartItems = props.items.slice(0, splitIndex)
    secondPartItems = props.items.slice(splitIndex)
    secondPartStartBullet = props.startBulletNumber + splitIndex
  }
  
  const firstPart = {
    type: 'TextList',
    data: {
      mode: props.mode,
      items: firstPartItems,
      startBulletNumber: props.startBulletNumber,
      isSplit: true,
      isFirstSplit: props.isFirstSplit ?? true, // Inherit from parent, default to true if not set
      isFirstChildSplit: isFirstChildSplit
    }
  }

  const secondPart = {
    type: 'TextList',
    data: {
      mode: props.mode,
      items: secondPartItems,
      startBulletNumber: secondPartStartBullet,
      isSplit: true,
      isFirstSplit: false,
      isFirstChildSplit: isSecondChildSplit
    }
  }

  // Safety check: ensure we're making progress
  if (secondPartItems.length === 0) {
    if (logger) {
      logger.addLog(`Error: Split resulted in empty second part. Cannot split further.`, 'TextList.trySplit', 2)
    }
    return {
      code: 0,
      data: null
    }
  }
  
  if (firstPartItems.length === 0) {
    if (logger) {
      logger.addLog(`Error: Split resulted in empty first part. Forcing minimal split.`, 'TextList.trySplit', 2)
    }
    // Put one item in first part to make progress
    firstPartItems = [secondPartItems[0]]
    secondPartItems = secondPartItems.slice(1)
    if (secondPartItems.length === 0) {
      return {
        code: 0,
        data: null
      }
    }
  }

  if (logger) {
    logger.addLog(`Split TextList: first part has ${firstPartItems.length} items, second part has ${secondPartItems.length} items`, 'TextList.trySplit')
  }

  return {
    code: 1,
    data: [firstPart, secondPart]
  }
}

defineExpose({
  trySplit
})
</script>

<style scoped>
.text-list-component {
  display: block;
}

.list-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
}

.bullet {
  margin-right: 0px;
  flex-shrink: 0;
  min-width: 18px;
}

.bullet.invisible {
  visibility: hidden;
}
</style>
