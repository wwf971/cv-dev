// core function: updatePaginationComponents()

import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { PAGE_SIZES } from '@/config.js'

export const usePaginationStore = defineStore('pagination', () => {
  // Reactive data for page lines
  const pageLines = ref([])
  
  // Configuration values - imported from centralized config
  const config = ref({
    ...PAGE_SIZES
  })
  
  // Dynamic container information
  const containerInfo = ref({
    width: 0,
    height: 0,
    containerTop: 0
  })
  
  // Status for debugging
  const status = ref('Ready')
  
  // Registry for AlignToPageBegin components
  const registeredComponents = ref(new Map())
  const isUpdating = ref(false)
  const isUpdatingPageLines = ref(false)
  const lastPageLineUpdate = ref(0)
  
  // Registration completion tracking
  const expectedComponentCount = ref(0)
  const registrationComplete = ref(false)
  const registrationTimeoutId = ref(null)
  
  // Pagination mode state
  const isPaginationActive = ref(false)
  
  // Helper function to sort pageLines
  const sortPageLines = () => {
    pageLines.value.sort((a, b) => {
      // First sort by page number
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber
      }
      // For same page number, 'begin' comes before 'end'
      if (a.type !== b.type) {
        return a.type === 'begin' ? -1 : 1
      }
      // If same type and page, sort by y position
      return a.y - b.y
    })
  }
  
  // Helper function to validate pageLines structure
  const validatePageLines = () => {
    const pageGroups = {}
    pageLines.value.forEach(line => {
      if (!pageGroups[line.pageNumber]) {
        pageGroups[line.pageNumber] = { begin: null, end: null }
      }
      if (pageGroups[line.pageNumber][line.type]) {
        console.warn(`⚠️  Duplicate ${line.type} line for page ${line.pageNumber}:`, line)
      }
      pageGroups[line.pageNumber][line.type] = line
    })
    
    // Check each page has both begin and end
    Object.keys(pageGroups).forEach(pageNum => {
      const page = pageGroups[pageNum]
      if (!page.begin) {
        console.error(`❌ Page ${pageNum} missing begin line`)
      }
      if (!page.end) {
        console.error(`❌ Page ${pageNum} missing end line`)
      }
      if (page.begin && page.end && page.begin.y >= page.end.y) {
        console.error(`❌ Page ${pageNum} begin line (${page.begin.y.toFixed(1)}) not before end line (${page.end.y.toFixed(1)})`)
      }
    })
    
    return Object.keys(pageGroups).length
  }
  
  // Reference to the Pagination2 component for dynamic updates
  const paginationComponent = ref(null)
  
  // Actions
  const setPageLines = (lines) => {
    // Ensure proper ordering: by pageNumber, then by type (begin before end)
    const sortedLines = [...lines].sort((a, b) => {
      // First sort by page number
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber
      }
      // For same page number, 'begin' comes before 'end'
      if (a.type !== b.type) {
        return a.type === 'begin' ? -1 : 1
      }
      // If same type and page, sort by y position
      return a.y - b.y
    })
    
    // Check if lines are actually different before updating
    const currentLines = pageLines.value
    const isSame = currentLines.length === sortedLines.length && 
      currentLines.every((line, index) => {
        const newLine = sortedLines[index]
        return line.pageNumber === newLine.pageNumber && 
               line.type === newLine.type && 
               Math.abs(line.y - newLine.y) < 0.1
      })
    
    if (isSame) {
      console.log('📊 Page lines unchanged - skipping update')
      return
    }
    
    pageLines.value = sortedLines
    
    // Debug: Verify ordering and validate structure
    const totalPages = validatePageLines()
    console.log('📊 Page lines set with proper ordering:', {
      totalLines: sortedLines.length,
      totalPages: totalPages,
      orderedLines: sortedLines.map(line => ({
        pageNumber: line.pageNumber,
        type: line.type,
        y: line.y.toFixed(1)
      }))
    })
  }
  
  const setConfig = (newConfig) => {
    config.value = { ...config.value, ...newConfig }
  }
  
  const setContainerInfo = (info) => {
    containerInfo.value = { ...containerInfo.value, ...info }
  }
  
  const setStatus = (newStatus) => {
    status.value = newStatus
  }
  
  const clearPageLines = () => {
    pageLines.value = []
    status.value = 'Ready'
  }
  
  let isInitPageLines = false
  const initPageLines = () => {
    // remove all page lines using clearPageLines()
    clearPageLines()
    isInitPageLines = true
    isUpdatingPageLines.value = true
    try{
      // add pairs of page begin lines and page end lines, such that last page end line is lower than .page_a4_width's bottom height.
      const page_a4 = document.querySelector('.page_a4_width')
      if (!page_a4) return
      
      const page_a4_bottom = page_a4.getBoundingClientRect().bottom + window.scrollY
      const lines = []
      let pageNumber = 1
      let currentY = config.value.pageGap
      
      while (true) {
        // first page begin line, should align with .page_a4_width's top edge
        const pageBeginY = currentY
        lines.push({
          type: 'begin',
          pageNumber: pageNumber,
          y: pageBeginY
        })

        // page end line should be pageHeight below the previous page begin line
        const pageEndY = pageBeginY + config.value.effectivePageHeight
        lines.push({
          type: 'end',
          pageNumber: pageNumber,
          y: pageEndY
        })
        
        if (pageEndY >= page_a4_bottom) break

        // page begin line should be pageGap below the previous page end line
        currentY = pageEndY + config.value.pageGap
        pageNumber++
      }
      
      setPageLines(lines)
    }catch(error){
      console.error('initPageLines error:', error)
    }finally{
      isInitPageLines = false
      // Reset flag after Vue has time to re-render
      setTimeout(() => {
        isUpdatingPageLines.value = false
      }, 50)
    }
  }

  const updatePageLinesContainerTop = () => {
    const el_page_a4 = document.querySelector('.page_a4_width')
    if (!el_page_a4) return
    const el_page_a4_top = el_page_a4.getBoundingClientRect().top + window.scrollY
    console.warn('updatePageLinesContainerTop: el_page_a4_top:', el_page_a4_top)
    setContainerInfo({ containerTop: el_page_a4_top })
    initPageLines()
  }
  

  const appendPageLines = () => {
    // add a pair of page begin line and page end line
    const currentLines = [...pageLines.value]
    if (currentLines.length === 0) return
    
    const sortedLines = currentLines.sort((a, b) => a.y - b.y)
    const lastLine = sortedLines[sortedLines.length - 1]
    const newLines = []
    
    if (lastLine.type === 'end') {
      const nextPageNumber = lastLine.pageNumber + 1
      const pageBeginY = lastLine.y + config.value.pageGap
      const pageEndY = pageBeginY + config.value.effectivePageHeight
      
      newLines.push({
        type: 'begin',
        pageNumber: nextPageNumber,
        y: pageBeginY
      })
      
      newLines.push({
        type: 'end',
        pageNumber: nextPageNumber,
        y: pageEndY
      })
    } else if (lastLine.type === 'begin') {
      const pageEndY = lastLine.y + config.value.effectivePageHeight
      
      newLines.push({
        type: 'end',
        pageNumber: lastLine.pageNumber,
        y: pageEndY
      })
    }
    
    setPageLines([...currentLines, ...newLines])
  }
  
  let isAddingPageLinesToDocEnd = false
  const addPageLinesToDocEnd = () => {
    if(isAddingPageLinesToDocEnd) return
    isAddingPageLinesToDocEnd = true
    isUpdatingPageLines.value = true
    try{
      // keep appendPageLines(), until the last page end line is lower than .page_a4_width's bottom height.
      const container = document.querySelector('.page_a4_width')
      if (!container) return
      
      const containerHeight = container.offsetHeight
      let attempts = 0
      const maxAttempts = 20
      
      while (attempts < maxAttempts) {
        const currentLines = pageLines.value
        if (currentLines.length === 0) break
        
        const endLines = currentLines.filter(line => line.type === 'end')
        if (endLines.length === 0) {
          appendPageLines()
          attempts++
          continue
        }
        
        const lastEndLine = endLines.sort((a, b) => b.y - a.y)[0]
        if (lastEndLine.y >= containerHeight) break
        
        appendPageLines()
        attempts++
      }
    }catch(error){
      console.error('addPageLinesToDocEnd error:', error)
    }finally{
      isAddingPageLinesToDocEnd = false
      // Reset flag after Vue has time to re-render
      setTimeout(() => {
        isUpdatingPageLines.value = false
      }, 50)
    }
  }

  
  // Registration completion detection
  const countExpectedComponents = () => {
    // Count all cross-page components using unified class
    const crossPageElements = document.querySelectorAll('.cross-page')
    
    const total = crossPageElements.length
    
    console.log(`🎯 Expected component count: ${total} (all cross-page components)`)
    
    // Debug: Log what elements are being counted
    if (total > 0) {
      console.log('Cross-page elements found:', Array.from(crossPageElements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        componentType: el.dataset.componentType || 'unknown'
      })))
    }
    
    // If no components found, that might be an error or the DOM isn't ready yet
    if (total === 0) {
      console.warn('⚠️  No pagination components found in DOM. This might indicate:')
      console.warn('   - DOM not ready yet')
      console.warn('   - Components not mounted yet')
      console.warn('   - Missing "cross-page" class on components')
      console.warn('   - No pagination components on current page')
    }
    
    return total
  }
  
    const checkRegistrationComplete = () => {
    const currentCount = registeredComponents.value.size
    const expected = expectedComponentCount.value

    console.log(`📊 Registration progress: ${currentCount}/${expected} components registered`)

    // Consider registration complete if we have a reasonable number of components
    // Allow for small discrepancies due to DOM counting issues
    const isComplete = (currentCount >= expected && expected > 0) || 
                      (currentCount >= Math.max(1, expected - 2) && currentCount >= 10)

    if (isComplete) {
      registrationComplete.value = true
      if (currentCount === expected) {
        console.log(`✅ ALL COMPONENTS REGISTERED! Starting update cycle...`)
      } else {
        console.log(`✅ SUFFICIENT COMPONENTS REGISTERED! (${currentCount}/${expected}) Starting update cycle...`)
      }

      // Clear any pending timeout
      if (registrationTimeoutId.value) {
        clearTimeout(registrationTimeoutId.value)
        registrationTimeoutId.value = null
      }      
      return true
    }

    return false
  }
  
  const startRegistrationWaiting = () => {
    console.log(`🏁 Starting registration phase...`)
    
    // Count expected components
    expectedComponentCount.value = countExpectedComponents()
    registrationComplete.value = false
    
    // Set a fallback timeout (max 3 seconds)
    registrationTimeoutId.value = setTimeout(() => {
      const currentCount = registeredComponents.value.size
      const expected = expectedComponentCount.value
      
      if (currentCount >= Math.max(1, expected - 2) && currentCount >= 10) {
        console.log(`⏰ Registration timeout but sufficient components! ${currentCount}/${expected} registered. Proceeding...`)
        registrationComplete.value = true
        updatePageLinesContainerTop()
        updatePaginationComponents()
      } else {
        console.error(`⏰ Registration timeout! Only ${currentCount}/${expected} components registered. Proceeding anyway...`)
        registrationComplete.value = true
        updatePageLinesContainerTop()
        updatePaginationComponents()
      }
    }, 3000)
    
    // Check if already complete (in case all components registered very quickly)
    let result = checkRegistrationComplete()
    if(!result) {
      const currentCount = registeredComponents.value.size
      const expected = expectedComponentCount.value
      console.error(`⛔ Registration failed! Only ${currentCount}/${expected} components registered. Proceeding anyway...`)
    }
    updatePageLinesContainerTop()
    updatePaginationComponents()
  }

  // Component registration methods
  /**
   * Register a component with the pagination system
   * @param {string} componentId - Unique identifier for the component
   * @param {object} componentInstance - Component instance with getPosition and updateHeight methods
   * @param {string} componentType - Human-readable component type name (e.g., 'TrCrossPage', 'AlignToPageBegin')
   */
  const registerComponent = (componentId, componentInstance, componentType = 'Unknown') => {
    if (!isPaginationActive.value) {
      console.log(`Skipping registration of component ${componentId} - pagination 2 not active`)
      return
    }
    
    console.log(`🔗 Registering ${componentType}: ${componentId}. Total before: ${registeredComponents.value.size}`)
    registeredComponents.value.set(componentId, { ...componentInstance, componentType })
    console.log(`✅ ${componentType} registered: ${componentId}. Total after: ${registeredComponents.value.size}`)
    
    // Check if registration is now complete
    checkRegistrationComplete()
  }
  
  const unregisterComponent = (componentId) => {
    const component = registeredComponents.value.get(componentId)
    const componentType = component?.componentType || 'Unknown'
    
    console.log(`🔗 Unregistering ${componentType}: ${componentId}. Total before: ${registeredComponents.value.size}`)
    const deleted = registeredComponents.value.delete(componentId)
    console.log(`❌ ${componentType} unregistered: ${componentId} (${deleted}). Total after: ${registeredComponents.value.size}`)
  }
  
  // Pagination mode management
  const setPaginationActive = (active) => {
    const wasActive = isPaginationActive.value
    console.warn(`setPaginationActive: ${wasActive} -> ${active}`)
    console.log(`Before change - registeredComponents count: ${registeredComponents.value.size}`)
    isPaginationActive.value = active
    
    if (!active && wasActive) {
      // Mode turned off - clear all registered components and reset registration state
      console.log('Pagination 2 mode turned off - clearing all registered components')
      clearAllRegisteredComponents()
      
      // Reset registration tracking
      expectedComponentCount.value = 0
      registrationComplete.value = false
      if (registrationTimeoutId.value) {
        clearTimeout(registrationTimeoutId.value)
        registrationTimeoutId.value = null
      }
    }
    
    if (active && !wasActive) {
      // Mode turned on - start registration waiting phase
      console.log('🚀 Pagination 2 mode turned on - starting registration phase')
      console.log(`Initial registeredComponents count: ${registeredComponents.value.size}`)
      
      // Start registration waiting (with small delay to let components mount)
      setTimeout(() => {
        startRegistrationWaiting()
      }, 500)
      
      // Still show the debug info after 1 second
      setTimeout(() => {
        console.log(`After 1 second - registeredComponents count: ${registeredComponents.value.size}`)
        console.log(`Registered component IDs:`, Array.from(registeredComponents.value.keys()))
      }, 1000)
    }
  }
  
  const clearAllRegisteredComponents = () => {
    console.log(`Clearing ${registeredComponents.value.size} registered components`)
    console.log(`Component IDs being cleared:`, Array.from(registeredComponents.value.keys()))
    registeredComponents.value.clear()
    isUpdating.value = false
    isUpdatingPageLines.value = false
    console.log(`After clearing: ${registeredComponents.value.size} components remain`)
  }
const paginationDelayMode = 'adaptive' // 'fixed'

// Adaptive timing function for pagination updates
const waitForPaginationStability = async (maxWait = 150, checkInterval = 20) => {
  const startTime = Date.now()
  let stableCount = 0
  const requiredStableChecks = 2 // Need 2 consecutive stable measurements for pagination
  
  // Get all cross-page elements to monitor
  const crossPageElements = document.querySelectorAll('.cross-page')
  let lastHeights = Array.from(crossPageElements).map(el => el.offsetHeight)
  
  while (stableCount < requiredStableChecks && (Date.now() - startTime) < maxWait) {
    await new Promise(resolve => setTimeout(resolve, checkInterval))
    
    const currentHeights = Array.from(crossPageElements).map(el => el.offsetHeight)
    
    // Check if all heights are stable
    const allStable = currentHeights.every((height, index) => height === lastHeights[index])
    
    if (allStable) {
      stableCount++
    } else {
      stableCount = 0 // Reset if any height changed
      lastHeights = currentHeights
    }
  }
  
  const waitTime = Date.now() - startTime
  if (waitTime >= maxWait) {
    console.log(`⚠️ Pagination stability timeout after ${waitTime}ms`)
  } else {
    console.log(`✅ Pagination stable after ${waitTime}ms`)
  }
  
  return waitTime
}

const count = ref(0)
  // Sequential update method
const updatePaginationComponents = async () => {
  const delay_ms = 300;
  
  // Prevent direct calls - only allow when registration is complete
  if (!registrationComplete.value) {
    console.log(`⛔ updatePaginationComponents blocked - registration not complete (${registeredComponents.value.size}/${expectedComponentCount.value})`)
    return
  }
  
  await updatePageLines()
  if (isUpdating.value) {
    console.log('updatePaginationComponents(): Sequential update skipped - already updating')
    return // Prevent recursive updates
  }
  
  // Additional check: ensure this function isn't called while another instance is still running
  const updateId = Date.now()
  console.log(`updatePaginationComponents START: updateId=${updateId}, isUpdating=${isUpdating.value}`)
  
  if (isUpdating.value) {
    console.log(`updatePaginationComponents ABORT: updateId=${updateId} - another update in progress`)
    return
  }
  if(isUpdatingPageLines.value) {
    // wait for page lines update to finish (max 1 second)
    const startTime = Date.now()
    const timeout = 1000 // 1 second in milliseconds
    while(isUpdatingPageLines.value && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100)) // check every 100ms
    }
    if(isUpdatingPageLines.value) {
      console.error('updatePaginationComponents(): Timeout waiting for page lines update to finish')
      return
    }
  }

  isUpdating.value = true
  try {
    console.log(`Starting sequential component update: updateId=${updateId}, count=${count.value}`)
    console.log(`🚀 SINGLE UPDATE CYCLE STARTING: ${updateId} (Fixed double processing issue)`)
      
      // Debug: Check page lines state
      console.log('Page lines state at start of update:', {
        totalPageLines: pageLines.value.length,
        beginLines: pageLines.value.filter(line => line.type === 'begin').length,
        endLines: pageLines.value.filter(line => line.type === 'end').length,
        pageLinesSummary: pageLines.value.map(line => ({
          type: line.type,
          y: line.y.toFixed(1),
          pageNumber: line.pageNumber
        }))
      })
      
      // Get all registered components and sort by their top position
      const components = Array.from(registeredComponents.value.values())
      
      // Filter out components that are not mounted or don't have valid positions
      const validComponents = components.filter(comp => comp && comp.getPosition && comp.updateHeight)
      
      // Debug: Show which components were filtered out
      const filteredOut = components.filter(comp => !(comp && comp.getPosition && comp.updateHeight))
      if (filteredOut.length > 0) {
        console.error('⚠️  Components filtered out:', filteredOut.map(comp => ({
          componentId: comp?.componentId || 'unknown',
        })))
      }
      
      console.log(`Updating ${validComponents.length} components sequentially (${filteredOut.length} filtered out)`)

      validComponents.sort((a, b) => {
        const posA = a.getPosition()
        const posB = b.getPosition()
        return posA - posB
      })
      
      const sortedPositions = validComponents.map((comp, index) => ({
        index,
        position: comp.getPosition().toFixed(1)
      }))
    let component_index = 0
    // Update each component sequentially (note: validComponents captured at start, may grow during processing)
    for (const component of validComponents) {
      // Show processing progress with component type
      const componentType = component.componentType || 'Unknown'
      const componentId = component.componentId || 'unknown'
      console.error(`📍 UPDATE [${component_index}/${validComponents.length}] ${componentType}: ${componentId} (update_count: ${count.value})`)
      
      // Add visual debugging: highlight current component being updated
      let elCurrent = null
      try {
        // Try to find the DOM element for this component using unified cross-page class
        if (component.componentId) {
          const allCrossPageElements = document.querySelectorAll('.cross-page')
          for (const element of allCrossPageElements) {
            if (element.__vueParentComponent?.exposed?.componentId === component.componentId) {
              elCurrent = element
              break
            }
          }
        }
        
        if (elCurrent) {
          // Add highlight
          elCurrent.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'
          // elCurrent.style.border = '2px solid red'
          elCurrent.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)'
          // console.log(`  -> Added visual highlight to component: ${component.componentId}`)
        }
      } catch (error) {
        console.warn('Error adding visual highlight:', error)
      }
      
      await component.updateHeight()
      
      // Adaptive or fixed delay based on mode
      if (paginationDelayMode === 'adaptive') {
        // Wait for DOM stability with intelligent timing
        await waitForPaginationStability()
      } else {
        // Fallback: Fixed delay
        await new Promise(resolve => setTimeout(resolve, delay_ms))
      }
      
      await updatePageLines()
      
      // Second delay after page lines update
      if (paginationDelayMode === 'adaptive') {
        // Wait for page lines to stabilize
        await waitForPaginationStability(100, 15) // Shorter wait for page lines
      } else {
        // Fallback: Fixed delay  
        await new Promise(resolve => setTimeout(resolve, delay_ms))
      }
      
      // Remove visual debugging from current component
      if (elCurrent) {
        elCurrent.style.backgroundColor = ''
        elCurrent.style.border = ''
        elCurrent.style.boxShadow = ''
        // console.log(`  -> Removed visual highlight from component: ${component.componentId}`)
      }
      component_index++
    }
    
    console.log(`Sequential component update completed: updateId=${updateId} (processed ${component_index} components total)`)
    console.log(`✅ SINGLE UPDATE CYCLE COMPLETED: ${updateId} - All ${component_index} components processed!`)
  } catch (error) {
    console.error(`Error updating components sequentially: updateId=${updateId}`, error)
  } finally {
    isUpdating.value = false
    count.value++
    console.log(`updatePaginationComponents END: updateId=${updateId}, count=${count.value}`)
  }
}
  
  // Register the pagination component
  const registerPaginationComponent = (component) => {
    paginationComponent.value = component
  }
  
  // Method to trigger dynamic page line update
  const updatePageLines = async () => {
    if (isUpdatingPageLines.value) {
      console.log('Page line update already in progress, skipping')
      return
    }
    isUpdatingPageLines.value = true
    try {
      addPageLinesToDocEnd()
    } catch (error) {
      console.error('Error updating page lines:', error)
    } finally {
      isUpdatingPageLines.value = false
    }
  }
  // Method for components to call before page checks
  const ensurePageLinesUpdated = async () => {
    // Only update if we're not already in an update cycle
    if (isUpdating.value || isUpdatingPageLines.value) {
      console.log('Skipping page line update - already updating')
      return
    }
    await updatePageLines()
  }
  
  // DOM-based page line queries (NEW APPROACH)
  const getPageLineElPos = (element) => {
    if (!element) {
      console.log('getPageLineElPos: element is null')
      return null
    }
    return element.getBoundingClientRect().top + window.scrollY
  }
  
  const findNextPageBeginLineEl = (posCurrent) => {
    // iterate through page line elements, until the finding the first page begin line whose y is greater than posCurrent
    const pageLineElements = document.querySelectorAll('.page-line-begin')
    for (const element of pageLineElements) {
      
      const elementY = getPageLineElPos(element)
      
      if (elementY > posCurrent) {
        // console.warn('findNextPageBeginLineEl: element', element)
        // console.warn('findNextPageBeginLineEl: elementY', elementY)
        return element
      }
    }
    return null
  }

  const findNextPageEndLineEl = (posCurrent) => {
    // iterate through page line elements, until finding the first page end line whose y is greater than posCurrent
    const pageLineElements = document.querySelectorAll('.page-line-end')
    for (const element of pageLineElements) {
      
      const elementY = getPageLineElPos(element)
      
      if (elementY > posCurrent) {
        return element
      }
    }
    return null
  }
  
  const findPrevPageBeginEl = (posCurrent) => {
    const pageBeginElements = document.querySelectorAll('.page-line-begin')
    let closestElement = null
    let closestDistance = 0
    
    for (const element of pageBeginElements) {
      const elementY = getPageLineElPos(element)
      if (elementY <= posCurrent && elementY > closestDistance) {
        closestDistance = elementY
        closestElement = element
      }
    }
    
    return closestElement
  }
  
  const getCurrentPageInfoFromDOM = (posCurrent) => {
    const currentPageBeginElement = findPrevPageBeginEl(posCurrent)
    const nextPageBeginElement = findNextPageBeginLineEl(posCurrent)
    
    if (!currentPageBeginElement) return null
    
    const currentPageNumber = parseInt(currentPageBeginElement.dataset.pageNumber)
    const currentPageBeginY = getPageLineElPos(currentPageBeginElement)
    const nextPageBeginY = nextPageBeginElement ? getPageLineElPos(nextPageBeginElement) : null
    
    return {
      currentPage: currentPageNumber,
      currentPageBeginY: currentPageBeginY,
      nextPageBeginY: nextPageBeginY,
      distanceToNextPageBegin: nextPageBeginY ? nextPageBeginY - posCurrent : null,
      currentPageBeginElement,
      nextPageBeginElement
    }
  }

  const getNextPageBeginLineY = async (posCurrent) => {
    let nextPageBeginLineEl = findNextPageBeginLineEl(posCurrent)
    if(!nextPageBeginLineEl){
      appendPageLines()
      await nextTick()
      await nextTick()
      nextPageBeginLineEl = findNextPageBeginLineEl(posCurrent)
      if(!nextPageBeginLineEl){
        console.error('getNextPageBeginLineY: nextPageBeginLineEl not found')
        return 0;
      }
    }
    return nextPageBeginLineEl.getBoundingClientRect().top + window.scrollY
  }

  // Legacy getters (keeping for backward compatibility, but now use DOM-based approach)
  const getNextPageBeginLineYSync = (posCurrent) => {
    // wait for 10 seconds
    // await new Promise(resolve => setTimeout(resolve, 10000))
    const nextPageBeginLineEl = findNextPageBeginLineEl(posCurrent)
    let y = 0;

    if(nextPageBeginLineEl){
      y = nextPageBeginLineEl.getBoundingClientRect().top + window.scrollY;
    };
    // console.log(`getNextPageBeginLineYSync: posCurrent: ${posCurrent} y: ${y}`)
    return y;
  }
  
  const getPreviousPageBeginLine = (posCurrent) => {
    // Find the previous page begin line before the current position
    const previousBegins = pageLines.value.filter(line => 
      line.type === 'begin' && line.y <= posCurrent
    )
    return previousBegins[previousBegins.length - 1] || null
  }
  
  const getCurrentPageInfo = (posCurrent) => {
    // Get information about the current page based on position
    const currentPageBegin = getPreviousPageBeginLine(posCurrent)
    const nextPageBegin = getNextPageBeginLineYSync(posCurrent)
    
    if (!currentPageBegin) return null
    
    return {
      currentPage: currentPageBegin.pageNumber,
      currentPageBeginY: currentPageBegin.y,
      nextPageBeginY: nextPageBegin?.y || null,
      distanceToNextPageBegin: nextPageBegin ? nextPageBegin.y - posCurrent : null
    }
  }
  watch(isPaginationActive, (newVal) => {
    console.error(`isPaginationActive changed to ${newVal}`)
  })
  
  return {
    // State
    pageLines,
    config,
    containerInfo,
    status,
    registeredComponents,
    isUpdating,
    isUpdatingPageLines,
    paginationComponent,
    isPaginationActive,
    
    // Registration state
    expectedComponentCount,
    registrationComplete,
    
    // Actions
    setPageLines,
    setConfig,
    setContainerInfo,
    setStatus,
    clearPageLines,
    initPageLines,
    updatePageLinesContainerTop,
    appendPageLines,
    addPageLinesToDocEnd,
    registerComponent,
    unregisterComponent,
    setPaginationActive,
    clearAllRegisteredComponents,
    updatePaginationComponents,
    registerPaginationComponent,
    updatePageLines,
    ensurePageLinesUpdated,
    
    // Registration completion
    startRegistrationWaiting,
    countExpectedComponents,
    checkRegistrationComplete,
    
    // Legacy getters (for backward compatibility)
    getNextPageBeginLineY,
    getNextPageBeginLineYSync,
    getPreviousPageBeginLine,
    getCurrentPageInfo,
    
    // New DOM-based methods (preferred approach)
    getPageLineElPos,
    findNextPageBeginLineEl,
    findNextPageEndLineEl,
    findPrevPageBeginEl,
    getCurrentPageInfoFromDOM,
    
    // Helper functions (for debugging)
    sortPageLines,
    validatePageLines
  }
})
