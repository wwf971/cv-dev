<template>
  <div ref="textListRef" class="text-list-component">
    <div v-for="(item, index) in props.items" :key="index" class="list-item">
      <span 
        class="bullet" 
        :class="{ invisible: isInvisibleBullet(index) }" 
        :style="{ marginTop: bulletMarginTops[index] !== undefined ? `${bulletMarginTops[index]}px` : undefined }"
        v-if="shouldShowBullet(index)"
      >
        {{ getBullet(index) }}
      </span>
      <Text
        v-bind="getTextProps(item)"
        :ref="(el: any) => { if (el) textComponentRefs[index] = el }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onBeforeUpdate } from 'vue'
import Text from './Text.vue'

const props = withDefaults(defineProps<{
  mode?: 'ordered' | 'unordered' | 'paragraph'
  textDisplayMode?: 'bullet' | 'paragraph' | 'none' // 'bullet': show bullets, 'paragraph': prepend two spaces, 'none': no decoration
  items: any[] // List of Text component data
  startBulletNumber?: number
  isSplit?: boolean
  isFirstSplit?: boolean
  isFirstChildSplit?: boolean
  isFirstChildEmpty?: boolean // Whether the first child is empty (has no content)
}>(), {
  mode: 'unordered',
  textDisplayMode: 'bullet',
  startBulletNumber: 1,
  isSplit: false,
  isFirstSplit: false,
  isFirstChildSplit: false,
  isFirstChildEmpty: false
})

const textListRef = ref<HTMLElement | null>(null)
const textComponentRefs = ref<any[]>([])
const bulletMarginTops = ref<{ [key: number]: number }>({})
const logger = inject('paginationLogger', null) as any

onBeforeUpdate(() => {
  textComponentRefs.value = []
})


const shouldShowBullet = (index: number) => {
  // Only show bullets if textDisplayMode is 'bullet'
  if (props.textDisplayMode !== 'bullet') {
    return false
  }
  
  // Show bullets for all items in list modes (ordered, unordered, paragraph)
  // But skip empty items (when Text component has startIndex === endIndex)
  if (props.mode === 'ordered' || props.mode === 'unordered' || props.mode === 'paragraph') {
    const item = props.items[index]
    // Check if item is empty (Text component with startIndex === endIndex means no content)
    if (item && item.startIndex !== undefined && item.endIndex !== undefined && item.startIndex === item.endIndex) {
      return false
    }
    return true
  }
  return false
}

const isInvisibleBullet = (index: number) => {
  // First item's bullet is invisible if it's continuation of split child
  // BUT not if the first child on the previous page was empty (had no content)
  if (index === 0 && props.isSplit && !props.isFirstSplit && props.isFirstChildSplit) {
    // If first child was empty, this is effectively the start, so bullet should be visible
    if (props.isFirstChildEmpty) {
      return false
    }
    return true
  }
  return false
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

// Get text props with paragraph indentation if needed
const getTextProps = (item: any) => {
  // If textDisplayMode is 'paragraph', prepend two non-breaking spaces to content
  if (props.textDisplayMode === 'paragraph' && item.content) {
    // Check if content already starts with two spaces to avoid double-prepending
    // This can happen when split items are re-rendered
    const twoSpaces = '\u2003\u2003'
    if (item.content.startsWith(twoSpaces)) {
      return item // Already has the spaces
    }
    return {
      ...item,
      content: twoSpaces + item.content  // Two non-breaking spaces (U+2003: EM SPACE, same width as 1em)
    }
  }
  return item
}

// Calculate bullet alignment to match first line's vertical center of each Text component
const calcBulletYOffset = () => {
  if (!textListRef.value) {
    return
  }

  // Find the page-container element
  const pageContainer = textListRef.value.closest('.page-container')
  if (!pageContainer) {
    return
  }

  const pageRect = pageContainer.getBoundingClientRect()
  const listItems = textListRef.value.querySelectorAll('.list-item')

  listItems.forEach((listItem, index) => {
    const bulletElement = listItem.querySelector('.bullet')
    const textComponent = textComponentRefs.value[index]

    if (!bulletElement || !textComponent || typeof textComponent.getFirstLineYPos !== 'function') {
      return
    }

    // Get the first line's vertical center from Text component
    const textFirstLineCenter = textComponent.getFirstLineYPos()
    if (textFirstLineCenter === null) {
      return
    }

    // Get bullet's current vertical center position relative to page
    const bulletRect = bulletElement.getBoundingClientRect()
    const bulletTopRelativeToPage = bulletRect.top - pageRect.top
    const bulletCurrentCenter = bulletTopRelativeToPage + (bulletRect.height / 2)

    // Calculate the offset needed to align bullet center with text first line center
    const offset = textFirstLineCenter - bulletCurrentCenter

    // Store the offset
    bulletMarginTops.value[index] = offset
  })
}

// Pure function for splitting
const trySplit = (pageContext: any, docContext: any) => {
  if (logger) {
    logger.addLog(`TextList.trySplit called with ${props.items.length} items, mode=${props.mode}, textDisplayMode=${props.textDisplayMode}`, 'TextList.trySplit')
  }
  
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
  
  if (logger) {
    logger.addLog(`TextList position: listBottom=${listBottom.toFixed(2)}, pageBottomY=${pageBottomY.toFixed(2)}`, 'TextList.trySplit')
  }
  
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
    if (logger) {
      logger.addLog(`TextList fits completely (code: 0)`, 'TextList.trySplit')
    }
    // Calculate bullet alignment before returning
    calcBulletYOffset()
    
    return {
      code: 0,
      data: null
    }
  }
  
  if (logger) {
    logger.addLog(`TextList needs split`, 'TextList.trySplit')
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
            // NOTE: TextList items are direct Text props (not {type, data} structures)
            // so we extract .data to get the props object. This is different from TextRow/ImageRow!
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
  let isFirstChildEmpty = false

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
    
    // Check if the first part's last item (the split item's first part) is empty
    const firstPartLastItem = parts[0]
    if (firstPartLastItem && firstPartLastItem.startIndex !== undefined && 
        firstPartLastItem.endIndex !== undefined && 
        firstPartLastItem.startIndex === firstPartLastItem.endIndex) {
      isFirstChildEmpty = true
    }

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
      textDisplayMode: props.textDisplayMode,
      items: firstPartItems,
      startBulletNumber: props.startBulletNumber,
      isSplit: true,
      isFirstSplit: !props.isSplit || props.isFirstSplit, // True if first split OR inheriting true from parent
      isFirstChildSplit: isFirstChildSplit
    }
  }

  const secondPart = {
    type: 'TextList',
    data: {
      mode: props.mode,
      textDisplayMode: props.textDisplayMode,
      items: secondPartItems,
      startBulletNumber: secondPartStartBullet,
      isSplit: true,
      isFirstSplit: false,
      isFirstChildSplit: isSecondChildSplit,
      isFirstChildEmpty: isFirstChildEmpty
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

  // Calculate bullet alignment before returning split data
  calcBulletYOffset()

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
  margin-right: -2px;
  flex-shrink: 0;
  min-width: 18px;
  text-align: left;
  line-height: 1.2;
}

.bullet.invisible {
  visibility: hidden;
}
</style>
