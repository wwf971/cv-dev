<template>
  <div class="pagination-container">
    <!-- Hidden element to store pagination data for Puppeteer -->
    <div id="pagination-data" style="display: none;"></div>
    <!-- Hidden element to store padding configuration -->
    <div id="padding-config" style="display: none;" data-padding-top="40" data-padding-bottom="40" data-padding-left="40" data-padding-right="40"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Define component name
defineOptions({
  name: 'Pagination1'
})

// Status ref to track component state
const status = ref('Ready')
// Internal status tracking to prevent reactivity loops
let internalStatus = 'Ready'

// Safe status update function that prevents reactivity loops
const updateStatus = (newStatus) => {
  internalStatus = newStatus
  console.log(`Status updated to: ${newStatus}`)
  console.log(`isRunning: ${isRunning.value}`)
  // Only update reactive status if not currently processing pagination
  if (!isRunning.value) {
    console.log('Updating reactive status.value')
    status.value = newStatus
  } else {
    console.log('Skipping reactive status update - pagination is running')
  }
}

// Check if element is a leaf element with actual content
const isContentElement = (element) => {
  // Check for media elements
  const mediaElements = ['IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG']
  if (mediaElements.includes(element.tagName)) {
    return true
  }
  
  // Check for form elements
  const formElements = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']
  if (formElements.includes(element.tagName)) {
    return true
  }
  
  // Check for elements with direct text content (not just whitespace)
  const hasDirectText = Array.from(element.childNodes).some(node => 
    node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
  )
  
  if (hasDirectText) {
    return true
  }
  
  // Check for elements with background images or special classes
  const computedStyle = window.getComputedStyle(element)
  if (computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none') {
    return true
  }
  
  // Check for specific content classes like project covers
  if (element.classList.contains('project-cover') || 
      element.classList.contains('status-tag') ||
      element.classList.contains('skill-tag')) {
    return true
  }
  
  return false
}

// Check if a horizontal line is too close to any content element
const checkLineIntersection = (lineY, container) => {
  const allElements = container.querySelectorAll('*')
  const containerRect = container.getBoundingClientRect()
  const containerTop = containerRect.top + window.scrollY
  
  for (let element of allElements) {
    // Only check elements that actually contain content
    if (!isContentElement(element)) {
      continue
    }
    
    const elementRect = element.getBoundingClientRect()
    const elementTop = elementRect.top + window.scrollY - containerTop
    const elementBottom = elementRect.bottom + window.scrollY - containerTop
    
    // Ensure pagination line stays at least 3px away from content elements
    const safetyMargin = 3
    
    if (lineY >= elementTop - safetyMargin && lineY <= elementBottom + safetyMargin) {
      return true // Too close to content element
    }
  }
  return false
}

// Main pagination detection function
const detectPaginationDivisions = () => {
  if (!isInitialized) {
    console.log('Component not initialized, cannot run pagination detection')
    return
  }
  
  const container = document.querySelector('.page_a4_width')
  if (!container) {
    updateStatus('Error: .page_a4_width not found')
    return
  }
  
  updateStatus('Processing...')
  
  // Remove existing pagination lines
  const existingLines = container.querySelectorAll('.pagination-line')
  existingLines.forEach(line => line.remove())
  
  // Get padding configuration from hidden element
  const paddingConfig = document.getElementById('padding-config')
  const PADDING_TOP = paddingConfig ? parseInt(paddingConfig.dataset.paddingTop) : 40
  const PADDING_BOTTOM = paddingConfig ? parseInt(paddingConfig.dataset.paddingBottom) : 40
  const PADDING_LEFT = paddingConfig ? parseInt(paddingConfig.dataset.paddingLeft) : 40
  const PADDING_RIGHT = paddingConfig ? parseInt(paddingConfig.dataset.paddingRight) : 40
  
  // A4 dimensions and effective content area
  const A4_HEIGHT = 1122.24 // A4 height in pixels
  const EFFECTIVE_PAGE_HEIGHT = A4_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  
  const containerRect = container.getBoundingClientRect()
  const containerTop = containerRect.top + window.scrollY
  
  let currentPageTop = containerTop + PADDING_TOP
  let pageNumber = 1
  
  while (currentPageTop < containerTop + container.offsetHeight) {
    const targetY = currentPageTop + EFFECTIVE_PAGE_HEIGHT
    
    // Find all elements in the container
    const allElements = container.querySelectorAll('*')
    let bestElement = null
    let bestDistance = Infinity
    
    // Find the element whose bottom edge is closest to but above the target line
    for (let element of allElements) {
      const elementRect = element.getBoundingClientRect()
      const elementBottom = elementRect.bottom + window.scrollY
      
      if (elementBottom <= targetY) {
        const distance = targetY - elementBottom
        if (distance < bestDistance) {
          bestDistance = distance
          bestElement = element
        }
      }
    }
    
    let bestDivisionY = targetY - containerTop
    
    if (bestElement) {
      const elementRect = bestElement.getBoundingClientRect()
      bestDivisionY = elementRect.bottom + window.scrollY - containerTop
    }
    
    // Check if the proposed division line intersects with any element
    const hasIntersection = checkLineIntersection(bestDivisionY, container)
    
    // If there's an intersection, try to find a better position
    let finalDivisionY = bestDivisionY
    let isDashedLine = false
    
    if (hasIntersection) {
      // Try to find a position above the intersecting elements
      let foundBetter = false
      
      // Search upward for a gap between elements
      for (let offset = 10; offset <= 100; offset += 10) {
        const testY = bestDivisionY - offset
        if (testY > currentPageTop - containerTop + 50) { // Don't go too far back
          if (!checkLineIntersection(testY, container)) {
            finalDivisionY = testY
            foundBetter = true
            break
          }
        }
      }
      
      // If no better position found, use dashed line
      if (!foundBetter) {
        isDashedLine = true
      }
    }
    
    // Create pagination line
    const line = document.createElement('div')
    line.className = 'pagination-line'
    line.style.cssText = `
      position: absolute;
      top: ${finalDivisionY}px;
      left: 0;
      right: 0;
      height: 2px;
      background-color: red;
      z-index: 1000;
      opacity: 0.8;
      ${isDashedLine ? 'border-top: 2px dashed red; background-color: transparent;' : ''}
    `
    
    // Add page number label
    const label = document.createElement('div')
    label.className = 'pagination-label'
    label.textContent = `Page ${pageNumber}${isDashedLine ? ' (forced)' : ''}`
    label.style.cssText = `
      position: absolute;
      top: -20px;
      right: 10px;
      background-color: ${isDashedLine ? 'orange' : 'red'};
      color: white;
      padding: 2px 6px;
      font-size: 12px;
      border-radius: 3px;
    `
    
    line.appendChild(label)
    container.appendChild(line)
    
    currentPageTop = containerTop + finalDivisionY + EFFECTIVE_PAGE_HEIGHT
    pageNumber++
    
    // Safety check to prevent infinite loops
    if (pageNumber > 10) {
      console.warn('Pagination detection stopped - too many pages detected')
      break
    }
  }
  
  // Store pagination data for Puppeteer to read
  const paginationDataElement = document.getElementById('pagination-data')
  if (paginationDataElement) {
    const paginationLines = container.querySelectorAll('.pagination-line')
    
    // Convert pagination lines to page ranges with explicit begin and end positions
    const pageRanges = []
    
    if (paginationLines.length === 0) {
      // Single page document
      pageRanges.push({
        pageNumber: 1,
        beginY: 0,
        endY: container.offsetHeight,
        isDashed: false
      })
    } else {
      // Multi-page document
      const divisions = Array.from(paginationLines).map(line => {
        const top = parseFloat(line.style.top)
        return { y: top, isDashed: line.style.borderTop.includes('dashed') }
      })
      
      // First page: from 0 to first division
      pageRanges.push({
        pageNumber: 1,
        beginY: 0,
        endY: divisions[0].y,
        isDashed: false
      })
      
      // Middle pages: between divisions
      for (let i = 0; i < divisions.length - 1; i++) {
        pageRanges.push({
          pageNumber: i + 2,
          beginY: divisions[i].y,
          endY: divisions[i + 1].y,
          isDashed: divisions[i].isDashed
        })
      }
      
      // Last page: from last division to end
      const lastDivision = divisions[divisions.length - 1]
      const remainingHeight = container.offsetHeight - lastDivision.y
      if (remainingHeight > 50) { // Only create if there's meaningful content
        pageRanges.push({
          pageNumber: divisions.length + 1,
          beginY: lastDivision.y,
          endY: container.offsetHeight,
          isDashed: lastDivision.isDashed
        })
      }
    }
    
    // Add container dimensions and padding configuration
    const containerData = {
      width: container.offsetWidth,
      height: container.offsetHeight,
      paddingTop: PADDING_TOP,
      paddingBottom: PADDING_BOTTOM,
      paddingLeft: PADDING_LEFT,
      paddingRight: PADDING_RIGHT,
      pageHeight: A4_HEIGHT,
      effectivePageHeight: EFFECTIVE_PAGE_HEIGHT,
      algorithm: 'content-based',
      pageRanges: pageRanges // Use same format as Pagination_2
    }
    
    paginationDataElement.textContent = JSON.stringify(containerData)
  }
  
  updateStatus('Active')
}

// Function to clear pagination lines
const clearPaginationLines = () => {
  const container = document.querySelector('.page_a4_width')
  if (!container) return
  
  const existingLines = container.querySelectorAll('.pagination-line')
  existingLines.forEach(line => line.remove())
}

// Track if pagination is currently running to prevent infinite loops
const isRunning = ref(false)
const lastUpdateTime = ref(0)
const DEBOUNCE_DELAY = 500
const MIN_UPDATE_INTERVAL = 1000 // Minimum time between updates

// Debounced pagination detection
let paginationTimeout = null
const debouncedDetectPagination = () => {
  console.log('*** debouncedDetectPagination called ***')
  console.trace('Call stack:')
  
  if (!isInitialized) {
    console.log('Component not initialized yet, skipping pagination...')
    return
  }
  
  if (isRunning.value) {
    console.log('Pagination already running, skipping...')
    return
  }
  
  const now = Date.now()
  const timeSinceLastUpdate = now - lastUpdateTime.value
  
  // If we just ran pagination recently, skip to prevent infinite loops
  if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
    console.log('Pagination ran recently, skipping...')
    return
  }
  
  if (paginationTimeout) {
    clearTimeout(paginationTimeout)
  }
  
  paginationTimeout = setTimeout(() => {
    if (!isRunning.value) {
      console.log('Running pagination detection...')
      isRunning.value = true
      lastUpdateTime.value = Date.now()
      try {
        detectPaginationDivisions()
      } finally {
        isRunning.value = false
        // Update the reactive status to match the internal status
        console.log('About to update status.value to:', internalStatus)
        status.value = internalStatus
        console.log('Pagination detection completed')
      }
    }
  }, DEBOUNCE_DELAY)
}

// Lifecycle hooks
onMounted(() => {
  console.log('=== PAGINATION COMPONENT MOUNTED ===')
  
  // Initialize container height tracking
  const container = document.querySelector('.page_a4_width')
  if (container) {
    lastContainerHeight = container.offsetHeight
    console.log(`Initial container height: ${lastContainerHeight}`)
  } else {
    console.log('Container .page_a4_width not found during mount')
  }
  
  // Mark as initialized
  isInitialized = true
  console.log('Component initialized')
  
  // Initial pagination detection - only if not already running
  if (!isRunning.value) {
    console.log('Starting initial pagination detection')
    debouncedDetectPagination()
  }
})

// Store the last known container height for reference
let lastContainerHeight = 0
let isInitialized = false

// Manual function to re-run pagination detection (can be called externally)
const rerunPagination = () => {
  console.log('*** MANUAL PAGINATION RERUN REQUESTED ***')
  console.trace('Call stack:')
  if (!isRunning.value) {
    debouncedDetectPagination()
  } else {
    console.log('Pagination is already running, skipping manual rerun')
  }
}

// Initialize the component status
updateStatus('Ready')

// Remove automatic onUpdated hook to prevent infinite loops
// Pagination will only run on initial mount
// If needed, external components can call rerunPagination() manually

// Cleanup on unmount
onUnmounted(() => {
  console.log('=== PAGINATION COMPONENT UNMOUNTED ===')
  if (paginationTimeout) {
    clearTimeout(paginationTimeout)
  }
  clearPaginationLines()
})

// Expose status and rerun function to parent component
defineExpose({
  status,
  rerunPagination
})
</script>

<style scoped>
.pagination-container {
  /* This container is invisible but contains the hidden data divs */
}
</style> 