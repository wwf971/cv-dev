<template>
  <tr ref="trRef" :class="['tr-component', props.cssClass]" :style="props.cssStyle">
    <Td
      v-for="(td, index) in displayTds"
      :key="index"
      :items="td.items"
      :widthRatio="td.widthRatio"
      :isEmpty="td.isEmpty"
      :alignBottom="td.alignBottom"
      :colspan="td.colspan"
      :cssClass="td.cssClass"
      :cssStyle="td.cssStyle"
      :ref="(el: any) => { if (el) tdRefs[index] = el }"
    />
  </tr>
</template>

<script setup lang="ts">
import { ref, computed, inject, onBeforeUpdate } from 'vue'
import Td from './TableTd.vue'

const props = withDefaults(defineProps<{
  items: Array<{
    items: any[]
    widthRatio: number
    isEmpty?: boolean
    alignBottom?: boolean
    colspan?: number
    cssClass?: string
    cssStyle?: any
  }>
  cssClass?: string
  cssStyle?: any
  fillToPageBottom?: boolean  // If true, stretch split row to fill remaining space to pageBottomY
}>(), {
  fillToPageBottom: false
})

const trRef = ref<HTMLElement | null>(null)
const tdRefs = ref<any[]>([])
const logger = inject('paginationLogger', null) as any

onBeforeUpdate(() => {
  tdRefs.value = []
})

const displayTds = computed(() => props.items)

// Split function
const trySplit = (pageContext: any, docContext: any) => {
  if (!trRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !trRef.value ? 'trRef is null' : !docContext ? 'docContext param is null' : 'pageContext param is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'Tr.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }

  const trBottom = docContext.measureVerticalPosEnd(trRef.value)
  const trTop = docContext.measureVerticalPos(trRef.value)
  const pageBottomY = pageContext.pageBottomY
  
  if (logger) {
    logger.addLog(`Tr position: top=${trTop.toFixed(2)}, bottom=${trBottom.toFixed(2)}, height=${(trBottom-trTop).toFixed(2)}, pageBottomY=${pageBottomY?.toFixed(2)}`, 'Tr.trySplit')
  }
  
  // If entire tr fits, no split needed
  if (trBottom <= pageBottomY) {
    if (logger) {
      logger.addLog(`Tr fits in page`, 'Tr.trySplit')
    }
    return {
      code: 0,
      data: null
    }
  }

  if (logger) {
    logger.addLog(`Tr needs split. Tds: ${props.items.length}`, 'Tr.trySplit')
  }

  // Try to split each Td and find which one needs splitting
  const tdSplitResults: any[] = []
  let needsSplit = false
  let hasNotSplittable = false

  for (let i = 0; i < tdRefs.value.length; i++) {
    const tdRef = tdRefs.value[i]
    if (tdRef && typeof tdRef.trySplit === 'function') {
      const result = tdRef.trySplit(pageContext, docContext)
      tdSplitResults.push(result)
      
      if (result.code === 1) {
        needsSplit = true
        if (logger) {
          logger.addLog(`Td ${i} needs split (code: 1)`, 'Tr.trySplit')
        }
      } else if (result.code === 2) {
        hasNotSplittable = true
        if (logger) {
          logger.addLog(`Td ${i} doesn't fit and is not splittable (code: 2)`, 'Tr.trySplit')
        }
      } else if (logger) {
        logger.addLog(`Td ${i} fits (code: ${result.code})`, 'Tr.trySplit')
      }
    } else {
      tdSplitResults.push({ code: 0, data: null })
    }
  }

  // If any Td is not splittable (code 2), entire Tr is not splittable
  if (hasNotSplittable) {
    if (logger) {
      logger.addLog(`Tr has non-splittable Td, returning code 2`, 'Tr.trySplit')
    }
    return {
      code: 2,
      data: null
    }
  }

  if (!needsSplit) {
    // None of the Tds need splitting, but we're here because Tr overflows
    // If fillToPageBottom is true, create an empty first part and put all content in second part
    if (props.fillToPageBottom) {
      if (logger) {
        logger.addLog(`Tr overflows but no Td needs split - fillToPageBottom is true, creating empty first part`, 'Tr.trySplit')
      }
      // Force all TDs to be empty in first part, full content in second part
      needsSplit = true
      for (let i = 0; i < props.items.length; i++) {
        tdSplitResults[i] = {
          code: 1,
          data: [
            { type: 'Td', data: { items: [], widthRatio: props.items[i].widthRatio, isEmpty: true } },
            { type: 'Td', data: { items: props.items[i].items, widthRatio: props.items[i].widthRatio } }
          ]
        }
      }
    } else {
      // Move entire row to next page
      if (logger) {
        logger.addLog(`Tr overflows but no Td needs split - returning code 2 (move entire row to next page)`, 'Tr.trySplit', 1)
      }
      return {
        code: 2,
        data: null
      }
    }
  }

  // Create first and second Tr based on Td split results
  const firstTrTds: any[] = []
  const secondTrTds: any[] = []

  for (let i = 0; i < tdSplitResults.length; i++) {
    const result = tdSplitResults[i]
    
    if (result.code === 1) {
      // This Td was split
      if (logger) {
        logger.addLog(`Creating split Td ${i} with alignBottom=true`, 'Tr.trySplit')
      }
      firstTrTds.push({
        items: result.data[0].data.items,
        widthRatio: props.items[i].widthRatio,
        alignBottom: true, // Align to bottom when this Td is split
        colspan: props.items[i].colspan,
        cssClass: props.items[i].cssClass,
        cssStyle: props.items[i].cssStyle
      })
      secondTrTds.push({
        items: result.data[1].data.items,
        widthRatio: props.items[i].widthRatio,
        colspan: props.items[i].colspan,
        cssClass: props.items[i].cssClass,
        cssStyle: props.items[i].cssStyle
      })
    } else {
      // This Td was not split
      // Put all content in first part, empty in second part
      if (logger) {
        logger.addLog(`Creating non-split Td ${i} without alignBottom (stays top)`, 'Tr.trySplit')
      }
      firstTrTds.push({
        items: props.items[i].items,
        widthRatio: props.items[i].widthRatio,
        alignBottom: false, // Explicitly set to false to ensure top alignment
        colspan: props.items[i].colspan,
        cssClass: props.items[i].cssClass,
        cssStyle: props.items[i].cssStyle
      })
      secondTrTds.push({
        items: [],
        widthRatio: props.items[i].widthRatio,
        isEmpty: true,
        colspan: props.items[i].colspan,
        cssClass: props.items[i].cssClass,
        cssStyle: props.items[i].cssStyle
      })
    }
  }

  if (logger) {
    logger.addLog(`Split Tr: first part has ${firstTrTds.length} tds, second part has ${secondTrTds.length} tds`, 'Tr.trySplit')
  }

  // Calculate height for first part if fillToPageBottom is enabled
  let firstPartStyle = props.cssStyle
  
  if (props.fillToPageBottom && firstTrTds.length > 0) {
    const remainingHeight = pageBottomY - trTop
    if (remainingHeight > 0) {
      if (logger) {
        logger.addLog(`fillToPageBottom enabled: trTop=${trTop.toFixed(2)}, pageBottomY=${pageBottomY.toFixed(2)}, remainingHeight=${remainingHeight.toFixed(2)}px, firstTrTds.length=${firstTrTds.length}`, 'Tr.trySplit')
        logger.addLog(`firstTrTds content: ${JSON.stringify(firstTrTds.map((td, i) => `[${i}] items=${td.items?.length || 0}, isEmpty=${td.isEmpty}`)).slice(0, 200)}`, 'Tr.trySplit')
      }
      
      // Set both height and min-height on TR to fill to page bottom
      firstPartStyle = {
        ...(props.cssStyle || {}),
        height: `${remainingHeight}px`,
        minHeight: `${remainingHeight}px`
      }
    } else if (logger) {
      logger.addLog(`fillToPageBottom skipped: remainingHeight=${remainingHeight.toFixed(2)}px is not positive`, 'Tr.trySplit', 1)
    }
  }

  return {
    code: 1,
    data: [
      {
        type: 'Tr',
        data: {
          items: firstTrTds,
          cssClass: props.cssClass,
          cssStyle: firstPartStyle,
          fillToPageBottom: props.fillToPageBottom
        }
      },
      {
        type: 'Tr',
        data: {
          items: secondTrTds,
          cssClass: props.cssClass,
          cssStyle: props.cssStyle,
          fillToPageBottom: props.fillToPageBottom
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
/* No specific styles needed for tr */
</style>

