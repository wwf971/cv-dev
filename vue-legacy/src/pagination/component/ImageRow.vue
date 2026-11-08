<template>
  <div ref="imageRowRef" class="image-row-component" :style="{ textAlign: props.align }">
    <div class="images-container">
      <component
        v-for="(item, index) in visibleItems"
        :key="index"
        :is="getComponent(item.type)"
        v-bind="item.data"
        :ref="(el) => { if (el) componentRefs[index] = el }"
      />
    </div>
    <div v-if="props.caption" class="shared-caption">
      {{ props.caption }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUpdate, inject } from 'vue'
import Image from './Image.vue'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  align: {
    type: String,
    default: 'center',
    validator: (value) => ['left', 'center', 'right'].includes(value)
  },
  caption: {
    type: String,
    default: null
  }
})

const imageRowRef = ref(null)
const componentRefs = ref([])

onBeforeUpdate(() => {
  componentRefs.value = []
})

const logger = inject('paginationLogger', null)

const getComponent = (type) => {
  switch(type) {
    case 'Image':
      return Image
    default:
      return null
  }
}

const visibleItems = computed(() => props.items)

onMounted(() => {
  if (logger) {
    logger.addLog('ImageRow component mounted', 'ImageRow.onMounted')
  }
})

const trySplit = (pageContext, docContext, compIndex) => {
  if (!imageRowRef.value || !docContext || !pageContext) {
    if (logger) {
      logger.addLog('Error - missing refs or contexts', 'ImageRow.trySplit', 'Error')
    }
    return {
      code: -1,
      data: null
    }
  }

  if (logger) {
    logger.addLog(`Starting split analysis (compIndex: ${compIndex !== undefined ? compIndex : 'unknown'})`, 'ImageRow.trySplit')
  }

  const rowBottom = docContext.measureVerticalPosEnd(imageRowRef.value)
  const rowTop = docContext.measureVerticalPos(imageRowRef.value)
  const pageBottomY = pageContext.pageBottomY
  const pageStartY = pageContext.pageStartY || 0
  const rowHeight = rowBottom - rowTop
  const spaceRemaining = pageBottomY - rowBottom
  const overflow = rowBottom - pageBottomY
  const spaceBeforeRow = rowTop - pageStartY

  // Get more details about the row's parent and positioning
  const parentElement = imageRowRef.value.parentElement
  const parentTag = parentElement ? parentElement.tagName : 'unknown'
  const parentClass = parentElement ? parentElement.className : 'unknown'
  
  // Check if there are sibling elements before this ImageRow
  const siblings = parentElement ? Array.from(parentElement.children) : []
  const imageRowIndex = siblings.indexOf(imageRowRef.value)
  const siblingsBefore = siblings.slice(0, imageRowIndex)
  
  // Measure siblings to see what's taking up space
  let siblingsInfo = []
  if (siblingsBefore.length > 0 && docContext) {
    siblingsBefore.forEach((sibling, idx) => {
      const sibTop = docContext.measureVerticalPos(sibling)
      const sibBottom = docContext.measureVerticalPosEnd(sibling)
      const sibHeight = sibBottom - sibTop
      siblingsInfo.push(`${idx}[${sibling.tagName}.${sibling.className}]: ${sibHeight.toFixed(2)}px`)
    })
  }

  if (logger) {
    logger.addLog(`Row measurements - top: ${rowTop.toFixed(2)}, bottom: ${rowBottom.toFixed(2)}, height: ${rowHeight.toFixed(2)}`, 'ImageRow.trySplit')
    logger.addLog(`Page bounds - start: ${pageStartY.toFixed(2)}, bottom: ${pageBottomY.toFixed(2)}, total space: ${(pageBottomY - pageStartY).toFixed(2)}`, 'ImageRow.trySplit')
    logger.addLog(`Space analysis - before row: ${spaceBeforeRow.toFixed(2)}px, after row: ${spaceRemaining.toFixed(2)}px, overflow: ${overflow.toFixed(2)}px`, 'ImageRow.trySplit')
    logger.addLog(`Does ImageRow fit? ${rowBottom.toFixed(2)} <= ${pageBottomY.toFixed(2)} ? ${rowBottom <= pageBottomY}`, 'ImageRow.trySplit')
    logger.addLog(`ImageRow has ${props.items.length} images, ${componentRefs.value.length} refs, caption: ${props.caption ? 'yes' : 'no'}`, 'ImageRow.trySplit')
    logger.addLog(`Parent context: tag=${parentTag}, class="${parentClass}", position in parent: ${imageRowIndex}/${siblings.length}`, 'ImageRow.trySplit')
    if (siblingsInfo.length > 0) {
      logger.addLog(`Siblings before ImageRow: ${siblingsInfo.join(', ')}`, 'ImageRow.trySplit')
    }
    logger.addLog(`Component index: ${compIndex !== undefined ? compIndex : 'not provided'}, exceeds: ${rowBottom > pageBottomY}`, 'ImageRow.trySplit')
  }

  // Measure sub-components for detailed analysis
  const imagesContainer = imageRowRef.value.querySelector('.images-container')
  const captionElement = imageRowRef.value.querySelector('.shared-caption')
  
  if (logger && imagesContainer) {
    const containerBottom = docContext.measureVerticalPosEnd(imagesContainer)
    const containerTop = docContext.measureVerticalPos(imagesContainer)
    const containerHeight = containerBottom - containerTop
    logger.addLog(`Images container - top: ${containerTop.toFixed(2)}, bottom: ${containerBottom.toFixed(2)}, height: ${containerHeight.toFixed(2)}`, 'ImageRow.trySplit')
    
    if (captionElement) {
      const captionBottom = docContext.measureVerticalPosEnd(captionElement)
      const captionTop = docContext.measureVerticalPos(captionElement)
      const captionHeight = captionBottom - captionTop
      const captionMargin = captionTop - containerBottom
      logger.addLog(`Caption - top: ${captionTop.toFixed(2)}, bottom: ${captionBottom.toFixed(2)}, height: ${captionHeight.toFixed(2)}, margin from images: ${captionMargin.toFixed(2)}`, 'ImageRow.trySplit')
    }
  }

  // Unified loop: check items one by one for split opportunities
  let splitData = null

  if (componentRefs.value && componentRefs.value.length > 0) {
    for (let i = 0; i < componentRefs.value.length; i++) {
      const itemRef = componentRefs.value[i]
      if (itemRef && itemRef.$el) {
        const itemTop = docContext.measureVerticalPos(itemRef.$el)
        const itemBottom = docContext.measureVerticalPosEnd(itemRef.$el)
        const itemHeight = itemBottom - itemTop
        if (logger) {
          logger.addLog(`Image ${i} - top: ${itemTop.toFixed(2)}, bottom: ${itemBottom.toFixed(2)}, height: ${itemHeight.toFixed(2)}, exceeds: ${itemBottom > pageBottomY}`, 'ImageRow.trySplit')
        }

        if (itemBottom > pageBottomY) {
          if (logger) {
            logger.addLog(`Image ${i} exceeds page bottom`, 'ImageRow.trySplit')
          }

          // Try to split this image internally first (though images are typically not splittable)
          if (typeof itemRef.trySplit === 'function') {
            const itemSplitResult = itemRef.trySplit(pageContext, docContext)
            if (itemSplitResult && itemSplitResult.code === 1 && itemSplitResult.data) {
              if (logger) {
                logger.addLog(`Image ${i} can be split internally (${itemSplitResult.data.length} parts), splitting ImageRow at this point`, 'ImageRow.trySplit')
              }
              // Split the row at this item, replacing it with the split parts
              const beforeItems = props.items.slice(0, i)
              const afterItems = props.items.slice(i + 1)
              
              // CRITICAL: Extract split parts while preserving ALL properties
              // itemSplitResult.data contains array of component configs like: [{type: 'Image', data: {...}, ...other props}]
              // We MUST keep the entire object intact, not just extract specific properties
              // Array indexing and slice() naturally preserve all properties
              const firstPart = itemSplitResult.data[0]  // Keeps all properties: {type, data, ...}
              const remainingParts = itemSplitResult.data.slice(1)  // Keeps all properties for each item

              // Create split result: spread operators preserve all item properties
              // Shared caption only goes with the last part
              splitData = [
                {
                  type: 'ImageRow',
                  data: { items: [...beforeItems, firstPart], align: props.align }
                },
                {
                  type: 'ImageRow',
                  data: { 
                    items: [...remainingParts, ...afterItems],
                    align: props.align,
                    caption: props.caption  // Caption stays with last part
                  }
                }
              ]
              break
            }
          }

          // Image exceeds and can't be split internally - split row before this image
          if (logger) {
            logger.addLog(`Image ${i} cannot be split internally, splitting ImageRow before it`, 'ImageRow.trySplit')
          }
          splitData = [
            {
              type: 'ImageRow',
              data: { items: props.items.slice(0, i), align: props.align }
            },
            {
              type: 'ImageRow',
              data: { 
                items: props.items.slice(i),
                align: props.align,
                caption: props.caption  // Caption stays with last part
              }
            }
          ]
          break
        }
      }
    }
  }

  // If we found a split point, return it
  if (splitData) {
    if (logger) {
      logger.addLog(`Found split point during loop, returning code 1 with ${splitData.length} parts`, 'ImageRow.trySplit')
    }
    return {
      code: 1,
      data: splitData
    }
  }

  // If entire row fits, no split needed
  if (rowBottom <= pageBottomY) {
    if (logger) {
      logger.addLog('Entire row fits vertically, no split needed (code 0)', 'ImageRow.trySplit')
    }
    return {
      code: 0,
      data: null
    }
  }

  // Row doesn't fit but no individual items exceed - fall back to boundary splitting
  if (logger) {
    logger.addLog(`Row doesn't fit (bottom ${rowBottom.toFixed(2)} > page ${pageBottomY.toFixed(2)}) but no items detected exceeding - using boundary split`, 'ImageRow.trySplit')
  }

  // Find a split point - for images, we can't look for "splittable" items like text,
  // so we split somewhere in the middle or before the last few items
  let splitIndex = -1
  
  // Try to split before the second half of images
  if (props.items.length > 1) {
    splitIndex = Math.ceil(props.items.length / 2)
    if (logger) {
      logger.addLog(`Splitting ImageRow in middle at index ${splitIndex}`, 'ImageRow.trySplit')
    }
  }

  // If still no split point, move entire row
  if (splitIndex === -1 || splitIndex >= props.items.length) {
    if (logger) {
      logger.addLog('Cannot split row - moving entire row to next page (code 2)', 'ImageRow.trySplit')
    }
    return {
      code: 2,
      data: null
    }
  }

  const fittingItems = props.items.slice(0, splitIndex)
  const remainingItems = props.items.slice(splitIndex)

  if (logger) {
    logger.addLog(`Boundary split successful - first part: ${fittingItems.length} images, second part: ${remainingItems.length} images (code 1)`, 'ImageRow.trySplit')
  }

  return {
    code: 1,
    data: [
      {
        type: 'ImageRow',
        data: { items: fittingItems, align: props.align }
      },
      {
        type: 'ImageRow',
        data: { 
          items: remainingItems,
          align: props.align,
          caption: props.caption  // Caption stays with last part
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
.image-row-component {
  display: block;
  width: 100%;
}

.images-container {
  display: block;
  width: 100%;
  line-height: 0;
}

.images-container > * {
  display: inline-block;
  margin-right: 8px;
  vertical-align: top;
}

.images-container > *:last-child {
  margin-right: 0;
}

.shared-caption {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: #666;
  text-align: center;
  line-height: 1.4;
}
</style>
