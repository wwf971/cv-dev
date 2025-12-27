<template>
  <table ref="tableRef" :class="['table-component', props.cssClass]" :style="props.cssStyle">
    <tbody>
      <component
        v-for="(row, index) in displayRows"
        :key="index"
        :is="getComponent(row.type)"
        v-bind="row.data"
        :ref="(el: any) => { if (el) rowRefs[index] = el }"
      />
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { ref, computed, inject, onBeforeUpdate, onMounted, nextTick } from 'vue'
import Tr from './TableTr.vue'

const props = withDefaults(defineProps<{
  rows: any[]
  cssClass?: string
  cssStyle?: any
}>(), {
  rows: () => []
})

const tableRef = ref<HTMLElement | null>(null)
const rowRefs = ref<any[]>([])
const logger = inject('paginationLogger', null) as any

onBeforeUpdate(() => {
  rowRefs.value = []
})

// No width fixing in onMounted - rely on table-layout: fixed and widthRatio percentages

const displayRows = computed(() => props.rows)

const getComponent = (type: string) => {
  switch (type) {
    case 'Tr':
      return Tr
    default:
      return null
  }
}

// Split function - tables split by splitting rows
const trySplit = (pageContext: any, docContext: any, compIndex?: number) => {
  if (!tableRef.value || !docContext || !pageContext) {
    if (logger) {
      const reason = !tableRef.value ? 'tableRef is null' : !docContext ? 'docContext param is null' : 'pageContext param is null'
      logger.addLog(`Error: Cannot split - ${reason}`, 'Table.trySplit', 2)
    }
    return {
      code: -1,
      data: null
    }
  }

  const tableBottom = docContext.measureVerticalPosEnd(tableRef.value)
  const pageBottomY = pageContext.pageBottomY
  const pageEndY = pageContext.pageEndY
  const paddingBottom = pageContext.padding?.bottom || 0
  
  if (logger) {
    logger.addLog(`Table split check: tableBottom=${tableBottom.toFixed(2)}, pageBottomY=${pageBottomY?.toFixed(2)}, pageEndY=${pageEndY?.toFixed(2)}, paddingBottom=${paddingBottom}`, 'Table.trySplit')
  }
  
  // If entire table fits, no split needed
  if (tableBottom <= pageBottomY) {
    return {
      code: 0,
      data: null
    }
  }

  if (logger) {
    logger.addLog(`Table needs split. Rows: ${props.rows.length}`, 'Table.trySplit')
  }

  // Try to split rows
  let splitIndex = 0
  let rowNeedsSplit = false
  let rowSplitData: any = null

  for (let i = 0; i < rowRefs.value.length; i++) {
    const rowRef = rowRefs.value[i]
    if (rowRef && typeof rowRef.trySplit === 'function') {
      const result = rowRef.trySplit(pageContext, docContext)
      
      if (result.code === 1) {
        // This row needs to split
        rowNeedsSplit = true
        rowSplitData = {
          splitAtIndex: i,
          parts: result.data
        }
        splitIndex = i
        
        if (logger) {
          logger.addLog(`Row ${i} needs split`, 'Table.trySplit')
        }
        break
      } else if (result.code === 0) {
        // This row fits
        splitIndex = i + 1
      } else if (result.code === 2) {
        // This row doesn't fit and is not splittable - move to next page
        splitIndex = i
        if (logger) {
          logger.addLog(`Row ${i} doesn't fit and is not splittable (code: 2), splitting before it`, 'Table.trySplit')
        }
        break
      } else {
        // Error or unknown code
        if (logger) {
          logger.addLog(`Row ${i} returned error/unknown code ${result.code}`, 'Table.trySplit', 1)
        }
        splitIndex = i + 1
      }
    } else {
      splitIndex = i + 1
    }
  }

  // Create split parts
  let firstPartRows: any[] = []
  let secondPartRows: any[] = []

  if (rowNeedsSplit && rowSplitData) {
    const splitAtIndex = rowSplitData.splitAtIndex
    const parts = rowSplitData.parts
    
    firstPartRows = [...props.rows.slice(0, splitAtIndex), parts[0]]
    secondPartRows = [parts[1], ...props.rows.slice(splitAtIndex + 1)]
  } else {
    firstPartRows = props.rows.slice(0, splitIndex)
    secondPartRows = props.rows.slice(splitIndex)
  }

  // If second part is empty, no split is actually needed
  if (secondPartRows.length === 0) {
    if (logger) {
      logger.addLog(`All rows fit in Table, no split needed`, 'Table.trySplit')
    }
    return {
      code: 0,
      data: null
    }
  }

  if (logger) {
    logger.addLog(`Split Table: first part has ${firstPartRows.length} rows, second part has ${secondPartRows.length} rows`, 'Table.trySplit')
  }

  return {
    code: 1,
    data: [
      {
        type: 'Table',
        data: {
          rows: firstPartRows,
          cssClass: props.cssClass,
          cssStyle: props.cssStyle
        }
      },
      {
        type: 'Table',
        data: {
          rows: secondPartRows,
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
.table-component {
  border-collapse: collapse;
  width: 100%;
  border: 1px solid #000;
  table-layout: fixed;
}
</style>

