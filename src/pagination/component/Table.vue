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
import { ref, computed, inject, onBeforeUpdate } from 'vue'
import Tr from './TableTr.vue'

/**
 * Props:
 * - removeTopBorderIfNotFirst: When true, removes 'td-no-top-border' class from first row 
 *   if table is placed at page top (compIndex === 0). Useful for stacked tables that share 
 *   borders but need proper borders when split across pages.
 */
const props = withDefaults(defineProps<{
  rows: any[]
  cssClass?: string
  cssStyle?: any
  removeTopBorderIfNotFirst?: boolean
}>(), {
  rows: () => [],
  removeTopBorderIfNotFirst: false
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

// Helper: Remove td-no-top-border class from first row
const removeTopBorderClass = (rows: any[]) => {
  if (rows.length === 0) return rows
  
  const modifiedRows = [...rows]
  const firstRow = modifiedRows[0]
  
  if (firstRow && firstRow.data && firstRow.data.items) {
    const modifiedFirstRow = {
      ...firstRow,
      data: {
        ...firstRow.data,
        items: firstRow.data.items.map((item: any) => ({
          ...item,
          cssClass: item.cssClass ? item.cssClass.replace(/\s*td-no-top-border\s*/g, ' ').trim() : item.cssClass
        }))
      }
    }
    modifiedRows[0] = modifiedFirstRow
  }
  
  return modifiedRows
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
    // If this table has removeTopBorderIfNotFirst=true and is first on page (compIndex===0),
    // we need to modify the data to remove the td-no-top-border class
    // Return code: 1 with single element to "replace" the component with modified version
    if (props.removeTopBorderIfNotFirst && compIndex === 0) {
      const modifiedRows = removeTopBorderClass(props.rows)
      if (logger) {
        logger.addLog(`Table fits on page, is first component, removing top border class (returning as "split" with 1 part)`, 'Table.trySplit')
      }
      return {
        code: 1,
        data: [{
          type: 'Table',
          data: {
            rows: modifiedRows,
            cssClass: props.cssClass,
            cssStyle: props.cssStyle,
            removeTopBorderIfNotFirst: props.removeTopBorderIfNotFirst
          }
        }]
      }
    }
    
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

  // If removeTopBorderIfNotFirst is true, the second part will be at page top
  // so we should remove the td-no-top-border class to restore the border
  const finalSecondPartRows = props.removeTopBorderIfNotFirst 
    ? removeTopBorderClass(secondPartRows)
    : secondPartRows
  
  if (logger && props.removeTopBorderIfNotFirst) {
    logger.addLog(`Table split with removeTopBorderIfNotFirst=true. Second part border class removed.`, 'Table.trySplit')
  }

  return {
    code: 1,
    data: [
      {
        type: 'Table',
        data: {
          rows: firstPartRows,
          cssClass: props.cssClass,
          cssStyle: props.cssStyle,
          removeTopBorderIfNotFirst: props.removeTopBorderIfNotFirst
        }
      },
      {
        type: 'Table',
        data: {
          rows: finalSecondPartRows,
          cssClass: props.cssClass,
          cssStyle: props.cssStyle,
          removeTopBorderIfNotFirst: props.removeTopBorderIfNotFirst
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

