<template>
  <div class="pagination-root print:hidden">
    <div class="print:hidden" style="height: 20px"></div>
    <div class="pagination-content" :style="{ maxWidth: `${props.pageWidth}px` }">
      <Doc ref="docRef" :docId="docId">
        <div 
          v-for="(page, pageIndex) in pages" 
          :key="pageIndex"
          class="page-wrapper print:p-0 print:m-0 print:shadow-none"
          :class="{ 'print:page-break-after-always': pageIndex < pages.length - 1 }"
        >
          <Page 
            :ref="(el) => registerPageRef(pageIndex, el)"
            :pageIndex="page.sizes.pageIndex"
            :pageStartY="page.sizes.pageStartY ?? null"
            :pageEndY="page.sizes.pageEndY ?? null"
            :pageWidth="props.pageWidth"
            :pageHeight="page.sizes.pageHeight"
            :padding="page.sizes.padding"
          >
            <component
              v-for="(comp, compIndex) in page.components"
              :key="`${pageIndex}-${compIndex}`"
              :ref="(el) => registerComponentRef(`page-${pageIndex}-comp-${compIndex}`, el)"
              :is="getComponent(comp.type)"
              v-bind="comp.data"
            />
          </Page>
        </div>
      </Doc>
    </div>
    <div class="extra-horizontal-space print:hidden" :style="{ width: `${extraSpaceWidth}px` }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, provide, nextTick, inject, getCurrentInstance } from 'vue'
import Doc from './component_core/Doc.vue'
import Page from './component_core/Page.vue'
import { getComponent } from './componentMapping.js'
import { A4_SIZES, PAGE_SIZES } from '../config.js'
import type { PagePadding, PageContext } from './pagination'
import { LogType } from './LogTypes'

const props = withDefaults(defineProps<{
  docId: string
  pageWidth?: number
  pageHeight?: number
  pagePadding?: PagePadding
  docDataInit?: any[]
}>(), {
  pageWidth: () => A4_SIZES.widthInPixels,
  pageHeight: () => PAGE_SIZES.pageHeight,
  pagePadding: () => ({ 
    top: PAGE_SIZES.paddingTop, 
    bottom: PAGE_SIZES.paddingBottom, 
    left: PAGE_SIZES.paddingLeft, 
    right: PAGE_SIZES.paddingRight 
  }),
  docDataInit: () => []
})

const pages = ref<any[]>([])
const docData = ref<any[]>([...props.docDataInit])

// Get ref to Doc component
const docRef = ref<any>(null)

// Helper to get docContext at runtime (from Doc component ref)
const getDocContext = () => {
  if (!docRef.value) return null
  // Doc exposes its measurement methods via defineExpose
  return {
    measureVerticalPos: docRef.value.measureVerticalPos,
    measureVerticalPosEnd: docRef.value.measureVerticalPosEnd,
    getDocRect: docRef.value.getDocRect
  }
}

// Extra horizontal space management
const extraSpaceWidth = ref(0)
const requestedWidths = new Map<string, number>()

const applyForExtraHorizontalSpaceRight = (requesterId: string, width: number) => {
  requestedWidths.set(requesterId, width)
  // Set to the maximum requested width
  extraSpaceWidth.value = Math.max(...Array.from(requestedWidths.values()))
  addLog(`Extra space requested: ${width}px by ${requesterId}, total: ${extraSpaceWidth.value}px`, 'spaceManager')
}

// Logging system
type LogEntry = {
  message: string
  from: string
  type: LogType
  timestamp?: string
}

const logs = ref<LogEntry[]>([])

const addLog = (message: string, from: string, type: LogType = LogType.Normal) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(2, '0')
  const tzOffset = -now.getTimezoneOffset()
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0')
  const tzSign = tzOffset >= 0 ? '+' : '-'
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}${ms}${tzSign}${tzHours}`
  
  logs.value.push({
    message,
    from,
    type,
    timestamp
  })
}

const getLogs = () => logs.value

// Provide logging API and space management to descendants
provide('paginationLogger', {
  addLog,
  getLogs
})

provide('paginationSpaceManager', {
  applyForExtraHorizontalSpaceRight
})

// Pagination APIs
type ComponentData = {
  type: string
  data: any
}

type PageData = {
  sizes: PageContext
  components: ComponentData[]
}



// Load pageDataExtra for custom page heights
const pageDataExtra = ref<any[]>([])
const pageDataExtraLoaded = ref(false)

const loadPageDataExtra = async () => {
  if (pageDataExtraLoaded.value) return
  
  try {
    const module = await import('./pageDataExtra')
    pageDataExtra.value = module.pageDataExtra || []
    addLog(`Loaded pageDataExtra with ${pageDataExtra.value.length} entries`, 'Pagination.init')
  } catch (e) {
    addLog(`No pageDataExtra found or error loading it`, 'Pagination.init')
  }
  pageDataExtraLoaded.value = true
}

const getCustomPageHeight = (pageIndex: number): number | null => {
  const customData = pageDataExtra.value.find(d => d.pageIndex === pageIndex)
  return customData?.pageHeight ?? null
}

const appendEmptyPage = (pageData: PageData[]) => {
  const pageIndex = pageData.length
  
  // Check for custom height
  const customHeight = getCustomPageHeight(pageIndex)
  const pageHeight = customHeight ?? props.pageHeight
  
  const effectiveHeight = pageHeight - props.pagePadding.top - props.pagePadding.bottom
  
  // Initially set positions to null, will measure after render
  const newPage: PageData = {
    sizes: {
      pageIndex,
      pageStartY: null,
      pageEndY: null,
      pageBottomY: null,
      pageHeight: pageHeight,
      padding: props.pagePadding
    },
    components: []
  }
  
  pageData.push(newPage)
  addLog(`Created page ${pageIndex} with height ${pageHeight}${customHeight ? ' (custom)' : ''}`, 'appendEmptyPage')
  return { pageIndexCurrent: pageIndex, pageDataCurrent: newPage }
}

const componentRefs = ref<Map<string, any>>(new Map())
const pageRefs = ref<Map<number, any>>(new Map())

const registerComponentRef = (key: string, ref: any) => {
  if (ref) {
    componentRefs.value.set(key, ref)
  }
}

const registerPageRef = (pageIndex: number, ref: any) => {
  if (ref) {
    pageRefs.value.set(pageIndex, ref)
  }
}

// Measure actual page positions from DOM
const measurePagePos = async () => {
  await nextTick()
  await nextTick() // Extra tick to ensure DOM is fully rendered
  
  const docContext = getDocContext()
  if (!docContext) {
    addLog('Cannot measure page positions: no docContext', 'measurePagePos', LogType.Warning)
    return
  }
  
  let measuredCount = 0
  pages.value.forEach((page, index) => {
    const pageRef = pageRefs.value.get(index)
    if (pageRef && pageRef.pageContainerRef) {
      try {
        const startY = docContext.measureVerticalPos(pageRef.pageContainerRef)
        const endY = docContext.measureVerticalPosEnd(pageRef.pageContainerRef)
        const bottomY = endY - page.sizes.padding.bottom
        
        page.sizes.pageStartY = startY
        page.sizes.pageEndY = endY
        page.sizes.pageBottomY = bottomY
        measuredCount++
        
        addLog(`Measured page ${index}: startY=${startY.toFixed(2)}, endY=${endY.toFixed(2)}, bottomY=${bottomY.toFixed(2)}`, 'measurePagePos')
      } catch (error) {
        addLog(`Error measuring page ${index}: ${error}`, 'measurePagePos', LogType.Error)
      }
    } else {
      addLog(`Page ${index} ref not found or pageContainerRef missing`, 'measurePagePos', LogType.Warning)
    }
  })
  
  addLog(`Measured ${measuredCount} of ${pages.value.length} pages`, 'measurePagePos')
  
  // Trigger reactivity
  pages.value = [...pages.value]
}

const trySplit = async (compData: ComponentData, pageIndex: number, compIndex: number, pageContext: PageContext, docContext: any): Promise<ComponentData[]> => {
  // Wait for component to be rendered
  await nextTick()
  
  // Find the component instance
  const compKey = `page-${pageIndex}-comp-${compIndex}`
  const compInstance = componentRefs.value.get(compKey)
  
  if (!compInstance) {
    addLog(`trySplit: No component instance found for ${compKey}`, `${compData.type}.trySplit`, LogType.Error)
    return [compData]
  }
  
  if (typeof compInstance.trySplit !== 'function') {
    addLog(`trySplit: Component ${compData.type} does not have trySplit method`, `${compData.type}.trySplit`, LogType.Error)
    return [compData]
  }
  
  addLog(`trySplit: Calling trySplit on ${compData.type} instance`, `${compData.type}.trySplit`)
  const result = compInstance.trySplit(pageContext, docContext, compIndex)
  
  if (!result) {
    addLog(`trySplit: Component returned null/undefined`, `${compData.type}.trySplit`, LogType.Error)
    return [compData]
  }
  
  // Component returns {code: number, data: any}
  // code < 0: error
  // code === 0: no split needed
  // code === 1: split needed, data contains array of ComponentData
  // code === 2: not splittable (entire component must move to next page)
  if (typeof result === 'object' && 'code' in result) {
    if (result.code < 0) {
      addLog(`trySplit: Component returned error (code: ${result.code})`, `${compData.type}.trySplit`, LogType.Error)
      return [compData]
    } else if (result.code === 0) {
      addLog(`trySplit: Component fits in page (code: 0)`, `${compData.type}.trySplit`)
      return [compData]
    } else if (result.code === 1) {
      if (Array.isArray(result.data) && result.data.length > 1) {
        addLog(`trySplit: Component split into ${result.data.length} parts (code: 1)`, `${compData.type}.trySplit`)
        return result.data as ComponentData[]
      } else {
        addLog(`trySplit: Component returned code 1 but invalid data`, `${compData.type}.trySplit`, LogType.Error)
        return [compData]
      }
    } else if (result.code === 2) {
      addLog(`trySplit: Component is not splittable, must move entirely to next page (code: 2)`, `${compData.type}.trySplit`, LogType.Warning)
      // Return empty array to signal "doesn't fit, move to next page"
      return []
    }
  }
  
  addLog(`trySplit: Unexpected result format from component`, `${compData.type}.trySplit`, LogType.Error)
  return [compData]
}

provide('registerComponentRef', registerComponentRef)

// Run pagination algorithm
const runPagination = async () => {
  // Load pageDataExtra if not already loaded
  await loadPageDataExtra()
  
  addLog(`Starting pagination with ${docData.value.length} components`, 'runPagination')
  
  // Wait for docContext to be available (Doc.vue needs to mount first)
  await nextTick()
  await nextTick()
  
  let docContext = getDocContext()
  let waitAttempts = 0
  while (!docContext && waitAttempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 10))
    docContext = getDocContext()
    waitAttempts++
  }
  
  if (!docContext) {
    addLog(`ERROR: docContext not available after ${waitAttempts} attempts`, 'runPagination', LogType.Error)
    return
  }
  
  addLog(`docContext available after ${waitAttempts} attempts`, 'runPagination')
  
  const pageData: PageData[] = []
  const docDataPaginated: ComponentData[] = [...docData.value]
  
  let compIndexCurrent = 0
  let pageCreationCount = 0
  const MAX_PAGES = 100 // Safety limit
  
  while (docDataPaginated.length > 0) {
    pageCreationCount++
    if (pageCreationCount > MAX_PAGES) {
      addLog(`ERROR: Safety break triggered after ${MAX_PAGES} pages`, 'runPagination', LogType.Error)
      break
    }
    
    const { pageIndexCurrent, pageDataCurrent } = appendEmptyPage(pageData)
    addLog(`Created page ${pageIndexCurrent + 1} (startY will be measured after render)`, 'runPagination')
    
    // Update pages to trigger render
    pages.value = [...pageData]
    
    // Measure the newly created page's position - wait for ref to be registered
    await nextTick()
    await nextTick()
    
    // Wait for pageRef to be available (with timeout)
    let pageRef: any = null
    let attempts = 0
    while (!pageRef && attempts < 10) {
      pageRef = pageRefs.value.get(pageIndexCurrent)
      if (!pageRef) {
        await new Promise(resolve => setTimeout(resolve, 10))
        attempts++
      }
    }
    
    if (pageRef && pageRef.pageContainerRef && docContext) {
      try {
        const startY = docContext.measureVerticalPos(pageRef.pageContainerRef)
        const endY = docContext.measureVerticalPosEnd(pageRef.pageContainerRef)
        const bottomY = endY - pageDataCurrent.sizes.padding.bottom
        pageDataCurrent.sizes.pageStartY = startY
        pageDataCurrent.sizes.pageEndY = endY
        pageDataCurrent.sizes.pageBottomY = bottomY
        pages.value = [...pageData] // Trigger reactivity
        addLog(`Measured new page ${pageIndexCurrent}: startY=${startY.toFixed(2)}, endY=${endY.toFixed(2)}, bottomY=${bottomY.toFixed(2)}`, 'runPagination')
      } catch (error) {
        addLog(`Error measuring new page ${pageIndexCurrent}: ${error}`, 'runPagination', LogType.Error)
      }
    } else {
      addLog(`Cannot measure new page ${pageIndexCurrent} after ${attempts} attempts: ref=${!!pageRef}, docContext=${!!docContext}`, 'runPagination', LogType.Warning)
    }
    
    while (true) {
      const compDataCurrent = docDataPaginated.shift()
      if (!compDataCurrent) {
        break
      }
      
      compIndexCurrent++
      addLog(`Processing component ${compIndexCurrent} (type: ${compDataCurrent.type})`, 'runPagination')
      
      // Try to add component to current page
      pageDataCurrent.components.push(compDataCurrent)
      
      // Update pages to trigger render
      pages.value = [...pageData]
      
      // Wait for DOM to fully settle after adding component
      // Don't assume anything is stable - measure in real-time
      await nextTick()
      await nextTick() // Extra tick for safety
      
      // For image components, give extra time for images to render and layout to stabilize
      if (compDataCurrent.type === 'ImageRow' || compDataCurrent.type === 'Image') {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      // Re-measure page position before trySplit to get accurate current measurements
      // This is critical because previous components may have loaded/expanded, shifting content
      const pageRef = pageRefs.value.get(pageIndexCurrent)
      if (pageRef && pageRef.pageContainerRef && docContext) {
        try {
          const startY = docContext.measureVerticalPos(pageRef.pageContainerRef)
          const endY = docContext.measureVerticalPosEnd(pageRef.pageContainerRef)
          const bottomY = endY - pageDataCurrent.sizes.padding.bottom
          pageDataCurrent.sizes.pageStartY = startY
          pageDataCurrent.sizes.pageEndY = endY
          pageDataCurrent.sizes.pageBottomY = bottomY
          addLog(`Re-measured page ${pageIndexCurrent} before trySplit: startY=${startY.toFixed(2)}, endY=${endY.toFixed(2)}, bottomY=${bottomY.toFixed(2)}`, 'runPagination')
        } catch (error) {
          addLog(`Error re-measuring page ${pageIndexCurrent}: ${error}`, 'runPagination', LogType.Warning)
        }
      }
      
      // Get page context and doc context for pure function call
      const currentPageContext = pageDataCurrent.sizes
      const compDataAfterSplitTrialList = await trySplit(compDataCurrent, pageIndexCurrent, pageDataCurrent.components.length - 1, currentPageContext, docContext)
      
      addLog(`trySplit returned ${compDataAfterSplitTrialList.length} parts`, 'runPagination')
      
      if (compDataAfterSplitTrialList.length === 1) {
        // No split needed, continue
        addLog(`Component ${compIndexCurrent} fits in page ${pageIndexCurrent + 1}`, 'runPagination')
        
        // CRITICAL: Wait for DOM to fully settle after adding component
        // When tables are split and their second parts are added to new pages, the browser needs time
        // to recalculate layouts and remove stale height values from the previous unsplit state.
        // Without this delay, split table parts may be measured with incorrect heights (e.g., 601px 
        // instead of actual 370px), causing subsequent components to incorrectly overflow to next pages.
        await new Promise(resolve => setTimeout(resolve, 200))
        
        continue
      } else if (compDataAfterSplitTrialList.length > 1) {
        // Split occurred
        addLog(`Component ${compIndexCurrent} split into ${compDataAfterSplitTrialList.length} parts`, 'runPagination')
        pageDataCurrent.components.pop()
        pageDataCurrent.components.push(compDataAfterSplitTrialList[0])
        docDataPaginated.unshift(...compDataAfterSplitTrialList.slice(1))
        break
      } else {
        // Empty array: component doesn't fit and cannot be split (code 2)
        // Remove from current page and push back to queue for next page
        addLog(`Component ${compIndexCurrent} doesn't fit and is not splittable, moving to next page`, 'runPagination', LogType.Warning)
        pageDataCurrent.components.pop()
        docDataPaginated.unshift(compDataCurrent)
        break
      }
    }
    
    // If page ended up empty (all components moved to next page), remove it
    if (pageDataCurrent.components.length === 0) {
      addLog(`Page ${pageIndexCurrent} is empty, removing it`, 'runPagination', LogType.Warning)
      pageData.pop()
    }
    
    if (docDataPaginated.length === 0) break
  }
  
  pages.value = pageData
  addLog(`Pagination complete: ${pages.value.length} pages created`, 'runPagination')

  // Measure actual page positions from DOM
  await measurePagePos()
}

// Page info APIs
const getPageNum = () => pages.value.length

const getPageInfo = (pageIndex: number) => {
  if (pageIndex < 0 || pageIndex >= pages.value.length) {
    return null
  }
  
  const page = pages.value[pageIndex]
  return {
    pageIndex: page.sizes.pageIndex,
    pageNumber: page.sizes.pageIndex + 1,
    pageStartY: page.sizes.pageStartY,
    pageEndY: page.sizes.pageEndY,
    pageBottomY: page.sizes.pageBottomY,
    pageHeight: page.sizes.pageHeight,
    padding: page.sizes.padding,
    componentCount: page.components.length,
    components: page.components.map((comp, idx) => ({
      index: idx,
      type: comp.type,
      data: comp.data
    }))
  }
}

// Change page data API
const changePageHeight = async (pageIndex: number, newHeight: number) => {
  if (pageIndex < 0 || pageIndex >= pages.value.length) {
    addLog(`Invalid page index: ${pageIndex}`, 'changePageHeight', LogType.Error)
    return
  }
  
  addLog(`Changing page ${pageIndex} height to ${newHeight}px`, 'changePageHeight')
  pages.value[pageIndex].sizes.pageHeight = newHeight
  
  // Trigger reactivity
  pages.value = [...pages.value]
  
  // Remeasure positions
  await measurePagePos()
}

// Expose methods to control panel
defineExpose({
  runPagination,
  setDocData: (newDocData: any[]) => {
    docData.value = [...newDocData]
  },
  getLogs,
  pages,
  getPageNum,
  getPageInfo,
  changePageHeight,
  getPages: () => JSON.parse(JSON.stringify(pages.value)),
  getDocData: () => JSON.parse(JSON.stringify(docData.value))
})
</script>

<style>
/* Import shared CV styles globally for all paginated components */
@import '../content/CvJp/styles-shared.css';
</style>

<style scoped>
.pagination-root {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.pagination-content {
  flex: 1;
  min-width: 0; /* Allow flex item to shrink below content size */
}

.page-wrapper {
  padding: 20px;
  margin-bottom: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.extra-horizontal-space {
  flex-shrink: 0;
  background-color: transparent;
  /* This space is for page line labels to overflow into */
}
</style>

