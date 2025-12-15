<!--
2 kind of split
    when props.vText is given -> char based split 
      核心函数 performHeightBasedTextSplit()
    otherwise -> element based split
      split based on first-level elements expanded from slots
      currently we don't split on second-level/deeper level
      核心函数 performHeightBasedElementSplit()
    !FORBIDDEN slot-based split
      slot might expand as multiple html elements
      split based on first-level elements expanded from slots provides better granularity

onMounted
  // 提取slot内容
  -> analyzeSlotChildren
    -> extractSlotContent

检测是否触发分页
  checkIsCrossPage()
    结果存放在isCrossPage

split point计算
  -> updateChildComponents
    -> performHeightBasedTextSplit() (for vText)
    -> performHeightBasedElementSplit() (for slots)
  -> updateFirstRowHeight
  -> updateSecondRowHeight

workflow
  updateHeight()
    5个step
-->

<template>
  <!-- Debug indicator -->
  <div v-if="isDebugMode && debugInfo.show" 
       class="debug-indicator no-render" 
       :style="debugInfo.style"
       :title="debugInfo.tooltip"
       @mouseenter="showTooltip = true"
       @mouseleave="showTooltip = false">
    <span class="debug-arrow">←</span>
    <span class="debug-text">{{ debugInfo.text }}</span>
    
    <!-- Custom tooltip -->
    <div v-if="showTooltip" 
         class="custom-tooltip" 
         :style="tooltipStyle">
      {{ debugInfo.tooltip }}
    </div>
  </div>

  <template v-if="!isCrossPage">
    <!-- Normal single row when not crossing page -->
    <tr ref="trRef" :class="[trClass, 'cross-page']" v-bind="$attrs" data-component-type="TrCrossPage">
      <slot />
    </tr>
  </template>
  
  <template v-else>
    <!-- Three rows when crossing page -->
    <!-- First row: content up to page end -->
    <tr ref="firstTrRef" :class="[trClass, 'first-part', 'cross-page']" v-bind="$attrs" data-component-type="TrCrossPage">
        <template v-for="(child, index) in childComponentsFirst" :key="`first-${index}`">
          <component 
            :is="child.component"
            v-bind="{ ...child.props, slotContent: child.slotContent }"
          />
        </template>
    </tr>
    
    <!-- Second row: invisible spacer -->
    <tr ref="spacerTrRef" class="spacer-row" style="border: none; background: transparent;">
      <td :colspan="totalColspan" class="spacer-cell"></td>
    </tr>
    
    <!-- Third row: remaining content from next page begin -->
    <tr ref="thirdTrRef" :class="[trClassThirdTr, 'second-part']" v-bind="$attrs">
        <template v-for="(child, index) in childComponentsThird" :key="`second-${index}`">
          <!--TdCrossPage components-->
          <component 
            :is="child.component"
            v-bind="{ ...child.props, slotContent: child.slotContent }"
          />
        </template>
    </tr>
  </template>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, useSlots, markRaw, watch } from 'vue'
import { usePaginationStore } from '@/panels/paginationStore.js'
import TdCrossPage from './TdCrossPage.vue'

const isDebugMode = ref(true);

// Debug info
const debugInfo = ref({
  show: false,
  text: '',
  tooltip: '',
  style: {}
})

// Custom tooltip
const showTooltip = ref(false)
const tooltipStyle = computed(() => ({
  position: 'absolute',
  top: '-30px', // Above the debug indicator
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: '#333',
  color: 'white',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  zIndex: '10000',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  pointerEvents: 'none'
}))

// Define component name
defineOptions({
  name: 'TrCrossPage',
  inheritAttrs: false
})

// Props
const props = defineProps({
  trClass: {
    type: String,
    default: ''
  },
  threshold: {
    type: Number,
    default: 0
  },
  hideEmptyFirstRow: {
    type: Boolean,
    default: false
  }
})

// Refs
const trRef = ref(null)
const firstTrRef = ref(null)
const spacerTrRef = ref(null)
const thirdTrRef = ref(null)

const currentY = ref(0)
const pageEndY = ref(null)
const componentId = ref(`tr-cross-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
const firstPartHeight = ref(0)

// Store
const paginationStore = usePaginationStore()

// Watch for pagination mode changes
watch(
  () => paginationStore.isPaginationActive,
  (isActive, wasActive) => {
    console.log(`TrCrossPage ${componentId.value}: pagination mode changed from ${wasActive} to ${isActive}`)
    if (isActive && !wasActive) {
      // Mode turned on - register component
      console.log(`TrCrossPage ${componentId.value}: registering component`)
      registerWithStore()
    } else if (!isActive && wasActive) {
      // Mode turned off - unregister component and reset state
      console.log(`TrCrossPage ${componentId.value}: unregistering component and resetting state`)
      unregisterFromStore()
      
      // Force reset to single row mode
      isCrossPage.value = false
      pageEndY.value = null
    }
  }
)

// Slots
const slots = useSlots()

// Child components analysis
const childComponents = ref([]) // when split is triggered, data here will be fed to TdCrossPage
const isCrossPage = ref(false)
const childComponentsFirst = ref([])
const childComponentsThird = ref([])

// Function to split slot content into first and third parts
const splitSlotContent = (slotContent, splitIndex = null) => {
  if (!slotContent) {
    return {
      first: null,
      third: null
    }
  }
  
  // If no split index provided, first part gets all content, third gets none
  if (splitIndex === null) {
    return {
      first: slotContent,
      third: null
    }
  }
  
  // Handle different types of slot content
  if (typeof slotContent === 'function') {
    // For render functions, we need to call it and split the result
    try {
      const vnodes = slotContent()
      const vnodesArray = Array.isArray(vnodes) ? vnodes : [vnodes]
      
      return {
        first: vnodesArray.slice(0, splitIndex),
        third: vnodesArray.slice(splitIndex)
      }
    } catch (error) {
      console.error('Error splitting render function slot content:', error)
      return {
        first: slotContent,
        third: null
      }
    }
  } else if (Array.isArray(slotContent)) {
    // For vnode arrays, split directly
    return {
      first: slotContent.slice(0, splitIndex),
      third: slotContent.slice(splitIndex)
    }
  } else {
    // Single vnode case
    return {
      first: splitIndex > 0 ? slotContent : null,
      third: splitIndex <= 0 ? slotContent : null
    }
  }
}

// Function to create child components with split content
const createChildComponents = (splitMode = 'none', splitIndex = null) => {
  const defaultSlot = slots.default?.()
  if (!defaultSlot) return []
  
  const components = []
  let colspanSum = 0
  
  defaultSlot.forEach((vnode, index) => {
    if (vnode.type === TdCrossPage || vnode.type?.name === 'TdCrossPage') {
      const props = vnode.props || {}
      const colspan = parseInt(props.colspan || 1)
      colspanSum += colspan
      
      // Extract slot content
      const slotContent = extractSlotContent(vnode)
      
      // Split slot content if in split mode
      const splitContent = splitSlotContent(slotContent, splitIndex)
      
      // Create component definition with split content
      const componentDef = {
        component: markRaw(TdCrossPage),
        props: {
          ...props,
          vText: props.vText || props['v-text'] || ''
        },
        slotContent: slotContent, // Keep original for reference
        slotContentFirst: splitContent.first,
        slotContentThird: splitContent.third,
        originalVnode: vnode
      }
      
      components.push(componentDef)
    }
  })
  
  totalColspan.value = Math.max(1, colspanSum)
  return components
}

// Create split content based on first-level element count
const createSplitContent = (originalSlotContent, elementSplitIndex) => {
  if (!originalSlotContent) return { first: null, third: null }
  
  // Handle function-based slot content
  if (typeof originalSlotContent === 'function') {
    try {
      const vnodes = originalSlotContent()
      const vnodesArray = Array.isArray(vnodes) ? vnodes : [vnodes]
      
      // Count first-level elements that will be rendered
      let totalElements = 0
      let elementCounts = []
      
      vnodesArray.forEach(vnode => {
        if (vnode.type?.name === 'ListComponent') {
          // For ListComponent, get the content array length
          const listContent = vnode.props?.content || []
          const listLength = Array.isArray(listContent) ? listContent.length : 1
          elementCounts.push(listLength)
          totalElements += listLength
        } else {
          // For other components (like h4), count as 1 element
          elementCounts.push(1)
          totalElements += 1
        }
      })
      
      // Element counting: totalElements=${totalElements}, splitIndex=${elementSplitIndex}
      
      // Create first part content
      const firstPartVNodes = []
      let elementCountSoFar = 0
      
      for (let i = 0; i < vnodesArray.length; i++) {
        const vnode = vnodesArray[i]
        const elementCount = elementCounts[i]
        
        if (elementCountSoFar + elementCount <= elementSplitIndex) {
          // Include this entire component
          firstPartVNodes.push(vnode)
          elementCountSoFar += elementCount
        } else if (elementCountSoFar < elementSplitIndex) {
          // Partially include this component (only applies to ListComponent)
          if (vnode.type?.name === 'ListComponent') {
            const remainingElements = elementSplitIndex - elementCountSoFar
            const clonedVnode = {
              ...vnode,
              props: {
                ...vnode.props,
                content: Array.isArray(vnode.props.content) 
                  ? vnode.props.content.slice(0, remainingElements)
                  : vnode.props.content
              }
            }
            firstPartVNodes.push(clonedVnode)
          }
          break
        } else {
          break
        }
      }
      
      // Create third part content
      const thirdPartVNodes = []
      elementCountSoFar = 0
      
      for (let i = 0; i < vnodesArray.length; i++) {
        const vnode = vnodesArray[i]
        const elementCount = elementCounts[i]
        
        if (elementCountSoFar + elementCount <= elementSplitIndex) {
          // Skip this component (already in first part)
          elementCountSoFar += elementCount
        } else if (elementCountSoFar < elementSplitIndex) {
          // Partially include this component (only applies to ListComponent)
          if (vnode.type?.name === 'ListComponent') {
            const skipElements = elementSplitIndex - elementCountSoFar
            const clonedVnode = {
              ...vnode,
              props: {
                ...vnode.props,
                content: Array.isArray(vnode.props.content) 
                  ? vnode.props.content.slice(skipElements)
                  : []
              }
            }
            if (Array.isArray(vnode.props.content) && vnode.props.content.slice(skipElements).length > 0) {
              thirdPartVNodes.push(clonedVnode)
            }
          }
          elementCountSoFar += elementCount
        } else {
          // Include this entire component
          thirdPartVNodes.push(vnode)
          elementCountSoFar += elementCount
        }
      }
      
      // Split content created: first=${firstPartVNodes.length}, third=${thirdPartVNodes.length}
      
      return {
        first: firstPartVNodes.length > 0 ? (() => firstPartVNodes) : null,
        third: thirdPartVNodes.length > 0 ? (() => thirdPartVNodes) : null
      }
    } catch (error) {
      console.error('Error splitting slot content:', error)
      return { first: originalSlotContent, third: null }
    }
  }
  
  // Handle array-based slot content (fallback)
  if (Array.isArray(originalSlotContent)) {
    const firstPart = originalSlotContent.slice(0, elementSplitIndex)
    const thirdPart = originalSlotContent.slice(elementSplitIndex)
    return {
      first: firstPart.length > 0 ? firstPart : null,
      third: thirdPart.length > 0 ? thirdPart : null
    }
  }
  
  // Single element case
  return {
    first: elementSplitIndex > 0 ? originalSlotContent : null,
    third: elementSplitIndex <= 0 ? originalSlotContent : null
  }
}

// Character-based text splitting for vText content
const splitTextAtPosition = (text, splitRatio) => {
  if (!text) return { first: '', second: '' }
  
  // For Japanese text, split by characters since it doesn't have spaces
  const chars = text.split('')
  const splitIndex = Math.floor(chars.length * splitRatio)
  
  const firstPart = chars.slice(0, splitIndex).join('')
  const secondPart = chars.slice(splitIndex).join('')
  
  return { first: firstPart, second: secondPart }
}

// Height-based text splitting for vText content
const performHeightBasedTextSplit = async (vText, pageEndY, threshold = 5) => {
  if (!firstTrRef.value || !vText) return { first: vText, second: '' }
  
  await nextTick()
  
  // Start with all text in first part
  const testProps = { vText: vText }
  childComponentsFirst.value = childComponents.value.map(child => ({
    ...child,
    props: { ...child.props, vText: vText },
    slotContent: child.slotContent
  }))
  
  await nextTick()
  
  // Check if we need to split
  const container = document.querySelector('.page_a4_width')
  if (!container) return { first: vText, second: '' }
  
  const containerRect = container.getBoundingClientRect()
  const containerTop = containerRect.top + window.scrollY
  
  // Measure current height
  const rect = firstTrRef.value.getBoundingClientRect()
  const trBottom = rect.bottom + window.scrollY - containerTop
  
  // If it doesn't cross the page end line, no split needed
  if (trBottom <= pageEndY) {
    return { first: vText, second: '' }
  }
  
  // Need to split - use binary search to find optimal split point
  const text = vText
  let left = 0
  let right = text.length
  let bestSplit = Math.floor(text.length * 0.5) // Start with middle
  
  console.log('Starting height-based text split:', {
    pageEndY,
    trBottom,
    textLength: text.length
  })
  
  // Binary search for optimal split point
  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    
    // Try this split
    const testFirstPart = text.substring(0, mid)
    const testSecondPart = text.substring(mid)
    
    childComponentsFirst.value = childComponents.value.map(child => ({
      ...child,
      props: { ...child.props, vText: testFirstPart },
      slotContent: child.slotContent
    }))
    
    await nextTick()
    
    // Measure height
    const newRect = firstTrRef.value.getBoundingClientRect()
    const newTrBottom = newRect.bottom + window.scrollY - containerTop
    
    if (newTrBottom <= pageEndY) {
      // This split fits, try to include more text
      bestSplit = mid
      left = mid + 1
    } else {
      // This split is too tall, try less text
      right = mid
    }
    
    // Prevent infinite loop
    if (right - left < 5) break
  }
  
  // Return the best split
  const firstPart = text.substring(0, bestSplit)
  const secondPart = text.substring(bestSplit)
  
  console.log('Height-based text split result:', {
    splitAt: bestSplit,
    firstLength: firstPart.length,
    secondLength: secondPart.length
  })
  
  return { first: firstPart, second: secondPart }
}

// Wait for DOM to stabilize by checking height changes
const waitForDOMStability = async (element, maxWait = 100, checkInterval = 10) => {
  if (!element) return
  
  let lastHeight = element.offsetHeight
  let stableCount = 0
  const requiredStableChecks = 3 // Need 3 consecutive stable measurements
  const startTime = Date.now()
  
  while (stableCount < requiredStableChecks && (Date.now() - startTime) < maxWait) {
    await new Promise(resolve => setTimeout(resolve, checkInterval))
    
    const currentHeight = element.offsetHeight
    if (currentHeight === lastHeight) {
      stableCount++
    } else {
      stableCount = 0 // Reset if height changed
      lastHeight = currentHeight
    }
  }
  
  const waitTime = Date.now() - startTime
  if (waitTime >= maxWait) {
    console.log(`⚠️ DOM stability timeout after ${waitTime}ms`)
  } else {
    console.log(`✅ DOM stable after ${waitTime}ms`)
  }
}

// Height-based first-level element splitting for slot content
// Linear search: test each element index until we find the maximum that fits
const performHeightBasedElementSplit = async (pageEndY, threshold = 5) => {
  if (!firstTrRef.value) return { splitIndex: 0, alreadyApplied: false }
  
  // Count first-level elements by checking the actual rendered content
  const firstRowTds = firstTrRef.value?.querySelectorAll('td')
  let totalElements = 0
  
  if (firstRowTds) {
    for (let td of firstRowTds) {
      // Count h4 elements
      const h4Elements = td.querySelectorAll('h4')
      totalElements += h4Elements.length
      
      // Count div elements that are direct children of content divs (from ListComponent)
      const listContainers = td.querySelectorAll('.content-item')
      totalElements += listContainers.length
    }
  }
  
  console.log(`🔍 SPLIT TEST: Found ${totalElements} total elements, testing one by one...`)
  
  let bestSplitIndex = 0
  let lastTestedIndex = -1
  
  // Test each element index linearly from 1 to totalElements
  for (let elementIndex = 1; elementIndex <= totalElements; elementIndex++) {
    console.log(`📊 Testing element ${elementIndex}/${totalElements}`)
    
    await analyzeSlotChildren(elementIndex)
    lastTestedIndex = elementIndex
    
    // Ensure DOM is fully updated before measurement
    await nextTick()
    await nextTick()
      // this might not be enought, sometimes you need to wait longer
      // to correctly calculate y position of element bottom
  
    // Wait 300ms to ensure all DOM updates are complete
      // This seems nececssary, sometimes 
    // await new Promise(resolve => setTimeout(resolve, 300))
  
    // Quicker than wait for 300ms
    await waitForDOMStability(firstTrRef.value)
  

    // Force a reflow to ensure accurate measurements
    firstTrRef.value.offsetHeight
    
    // Measure height of first row
    const rect = firstTrRef.value.getBoundingClientRect()
    const container = document.querySelector('.page_a4_width')
    const containerRect = container.getBoundingClientRect()
    const containerTop = containerRect.top + window.scrollY
    const trBottom = rect.bottom + window.scrollY - containerTop
    
    const fits = trBottom <= pageEndY
    const status = fits ? '✅ FITS' : '❌ EXCEEDS'
    
    console.log(`📏 Element ${elementIndex}: bottom=${trBottom.toFixed(1)}, pageEnd=${pageEndY.toFixed(1)} → ${status}`)
    
    if (fits) {
      // This element fits, update best split
      bestSplitIndex = elementIndex
    } else {
      // This element exceeds, stop testing
      console.log(`🛑 STOP: Element ${elementIndex} exceeds page end, using bestSplit=${bestSplitIndex}`)
      break
    }
  }
  
  console.log(`✨ FINAL RESULT: bestSplitIndex=${bestSplitIndex}`)
  
  // Check if we need to reapply the final split or if it's already applied
  const alreadyApplied = (lastTestedIndex === bestSplitIndex)
  console.log(`🔄 State: lastTested=${lastTestedIndex}, best=${bestSplitIndex}, alreadyApplied=${alreadyApplied}`)
  
  return { splitIndex: bestSplitIndex, alreadyApplied }
}

// Update the analyzeSlotChildren function to handle both vText and slot content
const analyzeSlotChildren = async (elementSplitIndex = null) => {
  // Create components without split (normal mode)
  childComponents.value = createChildComponents('none', null)
  
  // Check if we have vText content
  const hasVTextContent = childComponents.value.some(child => 
    child.props.vText && child.props.vText.trim()
  )
  
  if (hasVTextContent) {
    console.log('Detected vText content, using character-based splitting')
    
    if (elementSplitIndex === null) {
      // No splitting - create identical components for both parts
      childComponentsFirst.value = childComponents.value.map(child => ({
        ...child,
        props: { ...child.props },
        slotContent: child.slotContent
      }))
      
      childComponentsThird.value = childComponents.value.map(child => ({
        ...child,
        props: { ...child.props },
        slotContent: child.slotContent
      }))
    } else {
      // For vText content, elementSplitIndex is actually the split result from height-based splitting
      // This is a bit hacky but works with the current architecture
      const vTextChild = childComponents.value.find(child => 
        child.props.vText && child.props.vText.trim()
      )
      
      if (vTextChild && typeof elementSplitIndex === 'object' && elementSplitIndex.first !== undefined) {
        // elementSplitIndex is actually a split result object
        const splitResult = elementSplitIndex
        
        childComponentsFirst.value = childComponents.value.map(child => ({
          ...child,
          props: { 
            ...child.props, 
            vText: child.props.vText ? splitResult.first : child.props.vText
          },
          slotContent: child.slotContent
        }))
        
        childComponentsThird.value = childComponents.value.map(child => ({
          ...child,
          props: { 
            ...child.props, 
            vText: child.props.vText ? splitResult.second : child.props.vText
          },
          slotContent: child.slotContent
        }))
      } else {
        // Fallback - no split
        childComponentsFirst.value = childComponents.value.map(child => ({
          ...child,
          props: { ...child.props },
          slotContent: child.slotContent
        }))
        
        childComponentsThird.value = childComponents.value.map(child => ({
          ...child,
          props: { ...child.props },
          slotContent: child.slotContent
        }))
      }
    }
  } else {
    // Using element-based splitting for slot content
    
    if (elementSplitIndex === null) {
      // No splitting - create identical components for both parts
      childComponentsFirst.value = childComponents.value.map(child => ({
        ...child,
        props: { ...child.props },
        slotContent: child.slotContent
      }))
      
      childComponentsThird.value = childComponents.value.map(child => ({
        ...child,
        props: { ...child.props },
        slotContent: child.slotContent
      }))
    } else {
      // Split based on first-level element count
      childComponentsFirst.value = childComponents.value.map(child => {
        const splitContent = createSplitContent(child.slotContent, elementSplitIndex)
        return {
          ...child,
          props: { ...child.props },
          slotContent: splitContent.first
        }
      })
      
      childComponentsThird.value = childComponents.value.map(child => {
        const splitContent = createSplitContent(child.slotContent, elementSplitIndex)
        return {
          ...child,
          props: { ...child.props },
          slotContent: splitContent.third
        }
      })
    }
  }
}



const totalColspan = ref(1)
const firstRowComponents = ref([])
const thirdRowComponents = ref([])

// Helper function to extract slot content for preservation
const extractSlotContent = (vnode) => {
  if (!vnode.children || vnode.children.length === 0) return null
  
  try {
    // Store the original vnodes for the slot content
    // We'll pass this to TdCrossPage to render
    if (vnode.children && vnode.children.default) {
      // Slot content with render function
      return vnode.children.default
    } else if (Array.isArray(vnode.children)) {
      // Direct vnode children
      return vnode.children
    } else {
      // Single child
      return [vnode.children]
    }
  } catch (error) {
    console.log('TrCrossPage: Error extracting slot content:', error)
    return null
  }
}

// Methods
const updatePosition = () => {
  const activeRef = isCrossPage.value ? firstTrRef.value : trRef.value
  if (!activeRef) return
  
  const container = document.querySelector('.page_a4_width')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const trRect = activeRef.getBoundingClientRect()
  
  const containerTop = containerRect.top + window.scrollY
  const trTop = trRect.top + window.scrollY
  
  currentY.value = trTop - containerTop
}

const checkIsCrossPage = () => {
  const activeRef = isCrossPage.value ? firstTrRef.value : trRef.value
  if (!activeRef) return { shouldSplit: false, reason: 'no active ref' }
  
  // Find the page end line that this row might cross
  const currentPageInfo = paginationStore.getCurrentPageInfo(currentY.value)
  if (!currentPageInfo) return { shouldSplit: false, reason: 'no current page info' }
  
  const pageEndLines = paginationStore.pageLines.filter(line => line.type === 'end')
  const nextPageEndLine = pageEndLines.find(line => line.y > currentY.value)
  
  if (!nextPageEndLine) return { shouldSplit: false, reason: 'no next page end line' }
  
  const rect = activeRef.getBoundingClientRect()
  const container = document.querySelector('.page_a4_width')
  const containerRect = container.getBoundingClientRect()
  const containerTop = containerRect.top + window.scrollY
  const trBottom = rect.bottom + window.scrollY - containerTop
  
  pageEndY.value = nextPageEndLine.y
  
  // More conservative crossing detection
  const wouldCross = trBottom > nextPageEndLine.y + props.threshold
  
  // Additional check: ensure there's significant overlap
  const trHeight = rect.height
  const overlapAmount = trBottom - nextPageEndLine.y
  const overlapRatio = overlapAmount / trHeight
  
  // Only split if overlap is more than 20% of the element height or more than 30px
  const shouldSplit = wouldCross // && (overlapRatio > 0.01 || overlapAmount > 2)
  
  // Determine reason for split decision
  let reason = ''
  if (!nextPageEndLine) {
    reason = 'no page end line'
  } else if (!wouldCross) {
    reason = `margin ${(trBottom - nextPageEndLine.y).toFixed(1)}px < threshold ${props.threshold}px`
  } else if (overlapRatio <= 0.01 && overlapAmount <= 2) {
    reason = `overlap too small: ${overlapAmount.toFixed(1)}px (${(overlapRatio * 100).toFixed(1)}%)`
  } else {
    reason = `overlap ${overlapAmount.toFixed(1)}px (${(overlapRatio * 100).toFixed(1)}%)`
  }
  
  console.log('TrCrossPage checkIsCrossPage:', {
    currentY: currentY.value.toFixed(1),
    trBottom: trBottom.toFixed(1),
    trHeight: trHeight.toFixed(1),
    pageEndY: nextPageEndLine.y.toFixed(1),
    threshold: props.threshold,
    crossingThreshold: (nextPageEndLine.y + props.threshold).toFixed(1),
    overlapAmount: overlapAmount.toFixed(1),
    overlapRatio: overlapRatio.toFixed(3),
    wouldCross,
    shouldSplit,
    reason,
    margin: (trBottom - nextPageEndLine.y).toFixed(1)
  })
  
  return {
    shouldSplit,
    reason,
    pageEndY: nextPageEndLine?.y,
    overlapAmount,
    overlapRatio
  }
}

// Debug helper function
const updateDebugInfo = (shouldSplit, splitReason = '') => {
  if (!isDebugMode.value) return
  
  const activeRef = isCrossPage.value ? firstTrRef.value : trRef.value
  if (!activeRef) return
  
  const container = document.querySelector('.page_a4_width')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const trRect = activeRef.getBoundingClientRect()
  const containerTop = containerRect.top + window.scrollY
  const trTop = trRect.top + window.scrollY
  const trBottom = trRect.bottom + window.scrollY
  const trRight = trRect.right - containerRect.left
  
  // Position debug indicator: left edge at TR's right edge, vertically centered on TR's bottom edge
  const debugY = trBottom - containerTop
  const debugX = trRight
  
  debugInfo.value = {
    show: true,
    text: shouldSplit ? `SPLIT: ${splitReason}` : 'NO SPLIT',
    tooltip: shouldSplit ? `Split triggered: ${splitReason}` : `No split: ${splitReason}`,
    style: {
      position: 'absolute',
      top: `${debugY}px`,
      left: `${debugX}px`,
      transform: 'translateY(-50%)', // Center vertically on TR's bottom edge
      zIndex: '9999',
      backgroundColor: shouldSplit ? '#ff4444' : '#44ff44',
      color: 'white',
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '11px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      pointerEvents: 'auto', // Enable hover for tooltip
      cursor: 'help'
    }
  }
  
  console.log(`TrCrossPage ${componentId.value}: Debug - ${debugInfo.value.text} at Y=${debugY}, X=${debugX} (bottom-right corner)`)
  console.log(`TrCrossPage ${componentId.value}: Tooltip text: "${debugInfo.value.tooltip}"`)
}

// Exposed methods for store registration
const getPosition = () => {
  updatePosition()
  // console.log(`TrCrossPage ${componentId.value}: getPosition() = ${currentY.value.toFixed(1)}`)
  return currentY.value
}

// Method to reset component to non-pagination state
const paginationOff = async () => {
  console.log(`TrCrossPage ${componentId.value}: paginationOff() called`)
  
  // Reset component state
  isCrossPage.value = false
  pageEndY.value = null
  
  // Reset debug info
  if (isDebugMode.value) {
    debugInfo.value.show = false
    debugInfo.value.tooltip = ''
    showTooltip.value = false
  }
  
  // Remove height constraints from all TR elements
  const allTrRefs = [trRef.value, firstTrRef.value, spacerTrRef.value, thirdTrRef.value]
  allTrRefs.forEach(trElement => {
    if (trElement) {
      trElement.style.height = ''
      trElement.style.maxHeight = ''
      trElement.style.minHeight = ''
      trElement.style.overflow = ''
      trElement.style.display = '' // Reset display property for first row
      trElement.style.borderTop = '' // Reset top border
      trElement.style.borderBottom = '' // Reset bottom border
      
      // Also remove height constraints from TD elements
      const tds = trElement.querySelectorAll('td')
      tds.forEach(td => {
        td.style.height = ''
        td.style.maxHeight = ''
        td.style.minHeight = ''
        td.style.overflow = ''
        td.style.verticalAlign = ''
        td.style.borderTop = '' // Reset top border
        td.style.borderBottom = '' // Reset bottom border
        
        // Remove height constraints from content divs
        const contentDivs = td.querySelectorAll('.height-constrained-content, div')
        contentDivs.forEach(div => {
          div.style.maxHeight = ''
          div.style.overflow = ''
        })
      })
    }
  })
  
  // Reset child components to non-split mode
  await analyzeSlotChildren(null)
  
  console.log(`TrCrossPage ${componentId.value}: reset to non-pagination state`)
}

// Sequential update method following 5-step process
const updateHeight = async () => {
  // Clear previous debug info
  if (isDebugMode.value) {
    debugInfo.value.show = false
    debugInfo.value.tooltip = ''
    showTooltip.value = false
  }
  
  await nextTick()
  updatePosition()
  
  // Step 1: Detect whether to split
  const splitResult = checkIsCrossPage()
  const shouldCross = splitResult.shouldSplit
  
  if (shouldCross) {
    console.log('TrCrossPage crossing page:', {
      currentY: currentY.value,
      pageEndY: pageEndY.value
    })
  }
  
  // Enable crossing mode if needed
  if (shouldCross && !isCrossPage.value) {
    isCrossPage.value = true
    await nextTick()
    console.log('TrCrossPage enabled crossing mode')
  }
  
  if (isCrossPage.value) {
    // Re-extract slot content to get current reactive props before split operations
    await analyzeSlotChildren(null)
    
    // Wait for Vue to re-render template with updated childComponents
    await nextTick()
    
    // Step 2: Calculate text split (handled by first component)
    // Step 3: Put split text to child components
    await updateChildComponents()
    
    // Step 4: Decide first row's height
    await updateFirstRowHeight()
    
    // Step 4.5a: Check if first row is empty and hide it if necessary (after height calculation)
    
    if(props.hideEmptyFirstRow) {
      await checkAndHideEmptyFirstRow()
    }
    
    // Step 4.5b: Remove borders at split points for seamless pagination appearance
    // await removeSplitBorders()

    // Step 5: Decide second row's height
    await updateSecondRowHeight()
  }
  
  // Update debug info after all operations are complete
  if (isDebugMode.value) {
    await nextTick() // Wait for DOM to update
    updateDebugInfo(shouldCross, splitResult.reason)
  }
}

// Step 3: Update child components with split content
const updateChildComponents = async () => {
  if (!isCrossPage.value || !pageEndY.value) return
  
  // Step 3a: Check content type and apply appropriate splitting
  await analyzeSlotChildren(null) // Start with full content
  await nextTick()
  
  // Check if we have vText content
  const hasVTextContent = childComponents.value.some(child => 
    child.props.vText && child.props.vText.trim()
  )
  
  if (hasVTextContent) {
    console.log('Processing vText content with character-based splitting')
    
    // Get the vText content
    const vTextChild = childComponents.value.find(child => 
      child.props.vText && child.props.vText.trim()
    )
    
    if (vTextChild) {
      // do height-based text splitting
      const splitResult = await performHeightBasedTextSplit(vTextChild.props.vText, pageEndY.value, props.threshold)
      
      // Apply the split result
      await analyzeSlotChildren(splitResult)
      await nextTick()
      
      console.log('Applied vText split:', {
        firstLength: splitResult.first.length,
        secondLength: splitResult.second.length
      })
    }
  } else {
    console.log('Processing slot content with element-based splitting')
    
    // Perform height-based element splitting
    const splitResult = await performHeightBasedElementSplit(pageEndY.value, props.threshold)
    
    // Apply the final split only if it's not already applied
    if (!splitResult.alreadyApplied) {
      console.log(`Applying final split with element index: ${splitResult.splitIndex} (was not already applied)`)
      await analyzeSlotChildren(splitResult.splitIndex)
      await nextTick()
    } else {
      console.log(`Final split with element index: ${splitResult.splitIndex} (already applied during binary search)`)
    }
    
    console.log('Applied final split with element index:', splitResult.splitIndex)
  }
}

// Step 4: Update first row height to align with page end line
const updateFirstRowHeight = async () => {
  if (!isCrossPage.value || !pageEndY.value || !firstTrRef.value) return
  
  const containerRect = document.querySelector('.page_a4_width')?.getBoundingClientRect()
  if (!containerRect) return
  
  const containerTop = containerRect.top + window.scrollY
  const trTop = firstTrRef.value.getBoundingClientRect().top + window.scrollY - containerTop
  
  // Calculate exact height to align bottom with page end line
  const exactHeight = pageEndY.value - trTop
  // const finalHeight = Math.max(20, exactHeight)
  const finalHeight = exactHeight
  
  console.log('TR height calculation:', {
    trTop: trTop.toFixed(1),
    pageEndY: pageEndY.value.toFixed(1),
    exactHeight: exactHeight.toFixed(1),
    finalHeight: finalHeight.toFixed(1)
  })
  
    // Simple approach: set TR height and let content naturally fit
  firstTrRef.value.style.height = `${finalHeight}px`
  firstTrRef.value.style.maxHeight = `${finalHeight}px`
  firstTrRef.value.style.overflow = 'hidden'
  
  console.log('First row height set to align with page end:', finalHeight.toFixed(1) + 'px')
  
  // Verify actual height after applying constraints
  await nextTick()
  const actualFirstRowHeight = firstTrRef.value.getBoundingClientRect().height
  firstPartHeight.value = actualFirstRowHeight
  console.log('First row actual height after constraints:', {
    expected: finalHeight.toFixed(1),
    actual: actualFirstRowHeight.toFixed(1),
    heightDifference: (actualFirstRowHeight - finalHeight).toFixed(1),
    isCorrect: Math.abs(actualFirstRowHeight - finalHeight) < 5,
    firstPartHeight: firstPartHeight.value
  })
}

// Step 4.5a: Check if first row is empty and hide it if necessary (after height calculation)
const checkAndHideEmptyFirstRow = async () => {
  if (!isCrossPage.value || !firstTrRef.value) return
  
  // Check if all td components in first row are empty
  const tdAnalysis = childComponentsFirst.value.map((child, index) => {
    // Check if td has vText content
    const hasVTextContent = child.props.vText && child.props.vText.trim().length > 0
    
    // Check if td has slot content
    const hasSlotContent = child.slotContent && (
      (Array.isArray(child.slotContent) && child.slotContent.length > 0) ||
      (typeof child.slotContent === 'function')
    )
    
    return {
      index,
      hasVTextContent,
      hasSlotContent,
      isEmpty: !hasVTextContent && !hasSlotContent,
      vTextLength: child.props.vText ? child.props.vText.trim().length : 0,
      slotType: child.slotContent ? (Array.isArray(child.slotContent) ? 'array' : typeof child.slotContent) : 'none'
    }
  })
  
  const allTdsEmpty = tdAnalysis.every(td => td.isEmpty)
  
  console.log('TrCrossPage: First row TD analysis:', {
    totalTds: tdAnalysis.length,
    allEmpty: allTdsEmpty,
    details: tdAnalysis
  })
  
  if (allTdsEmpty) {
    console.log('TrCrossPage: All td elements in first row are empty, hiding first row')
    
    // Hide the first row
    firstTrRef.value.style.display = 'none'
    firstTrRef.value.style.height = '0px'
    firstTrRef.value.style.maxHeight = '0px'
    
    // Update firstPartHeight to 0 since row is hidden
    firstPartHeight.value = 0
  } else {
    // Ensure first row is visible (in case it was previously hidden)
    firstTrRef.value.style.display = ''
    console.log('TrCrossPage: First row has content, keeping it visible')
  }
}

// Step 4.5b: Remove borders at split points for seamless pagination appearance
const removeSplitBorders = async () => {
  if (!isCrossPage.value) return
  
  // Remove bottom border from first row (appears at end of page)
  if (firstTrRef.value) {
    firstTrRef.value.style.borderBottom = 'none'
    
    // Also remove bottom borders from all td elements in first row
    const firstRowTds = firstTrRef.value.querySelectorAll('td')
    firstRowTds.forEach(td => {
      td.style.borderBottom = 'none'
    })
    
    console.log('TrCrossPage: Removed bottom borders from first row')
  }
  
  // Remove top border from third row (appears at beginning of next page)
  if (thirdTrRef.value) {
    thirdTrRef.value.style.borderTop = 'none'
    
    // Also remove top borders from all td elements in third row
    const thirdRowTds = thirdTrRef.value.querySelectorAll('td')
    thirdRowTds.forEach(td => {
      td.style.borderTop = 'none'
    })
    
    console.log('TrCrossPage: Removed top borders from third row')
  }
}

// Step 5: Update second row height to align third row with next page begin
const updateSecondRowHeight = async () => {
  if (!isCrossPage.value || !pageEndY.value || !spacerTrRef.value) return
  
  // Wait for DOM to fully update after first row height changes
  await nextTick()
  await nextTick() // Extra wait to ensure DOM is stable
  
  // Measure actual current position of spacer row
  const container = document.querySelector('.page_a4_width')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const containerTop = containerRect.top + window.scrollY
  
  // Get the actual current top position of the spacer row
  const spacerRect = spacerTrRef.value.getBoundingClientRect()
  const spacerCurrentTop = spacerRect.top + window.scrollY - containerTop
  
  let targetTop = 0
  
  // Debug: log all available page lines
  // const allPageLines = paginationStore.pageLines
  // console.log('All page lines:', allPageLines.map(line => ({
  //   type: line.type,
  //   pageNumber: line.pageNumber,
  //   y: line.y,
  //   isFinal: line.isFinal
  // })))
  
  console.log('Current pageEndY:', pageEndY.value)
  console.log('Looking for next page begin after:', pageEndY.value)
  
  // Find next page begin line after current page end
  const nextBeginY = await paginationStore.getNextPageBeginLineY(pageEndY.value)
  console.log('updateSecondRowHeight: nextBeginY:', nextBeginY)
  
  if (nextBeginY) {
    // Normal case: target is next page begin line
    targetTop = nextBeginY
    // console.log('Using next page begin line at:', targetTop)
  } else {
    // Last page case: use page end + pageGap from configuration
    const pageGap = paginationStore.containerInfo.pageGap || 50
    targetTop = pageEndY.value + pageGap
    // console.log('Last page case: using page end + pageGap:', targetTop, '(pageGap:', pageGap, ')')
  }
  
  // Calculate the height needed to align third row with target
  const spacerHeight = Math.max(0, targetTop - spacerCurrentTop)
  
  spacerTrRef.value.style.height = `${spacerHeight}px`
  
  // Make sure third row doesn't have any unwanted height constraints
  if (thirdTrRef.value) {
    // Remove any height constraints from third row
    thirdTrRef.value.style.height = ''
    thirdTrRef.value.style.maxHeight = ''
    thirdTrRef.value.style.minHeight = ''
    
    // Also remove height constraints from third row's td elements
    const thirdRowTds = thirdTrRef.value.querySelectorAll('td')
    thirdRowTds.forEach(td => {
      td.style.height = ''
      td.style.maxHeight = ''
      td.style.minHeight = ''
    })
  }
  
  console.log('Spacer height recalculated after DOM update:', {
    spacerCurrentTop: spacerCurrentTop.toFixed(1),
    targetTop: targetTop.toFixed(1),
    spacerHeight: spacerHeight.toFixed(1),
    nextBeginY: nextBeginY
  })
  await nextTick()
}

// Component registration methods
const registerWithStore = async () => {
  console.log(`TrCrossPage ${componentId.value}: attempting to register, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (!paginationStore.isPaginationActive) {
    console.log(`TrCrossPage ${componentId.value}: skipping registration - pagination 2 not active`)
    return
  }
  
  // Check if already registered
  if (paginationStore.registeredComponents.has(componentId.value)) {
    console.log(`TrCrossPage ${componentId.value}: already registered, skipping`)
    return
  }
  
  const componentInstance = {
    getPosition,
    updateHeight,
    paginationOff,
    componentId: componentId.value
  }
  paginationStore.registerComponent(componentId.value, componentInstance, 'TrCrossPage')
  console.log(`TrCrossPage ${componentId.value}: successfully registered with store`)
  
  // DON'T call updateHeight() immediately - let the sequential update handle it
  console.log(`TrCrossPage ${componentId.value}: registered, waiting for sequential update`)
}

const unregisterFromStore = () => {
  console.log(`TrCrossPage ${componentId.value}: unregistering from store`)
  paginationStore.unregisterComponent(componentId.value)
  
  // Reset component state when unregistering
  isCrossPage.value = false
  pageEndY.value = null
  console.log(`TrCrossPage ${componentId.value}: unregistered and reset state`)
}
// Create trClass for third row without no-top-border
const trClassThirdTr = computed(() => {
  if (!props.trClass) return ''
  return props.trClass.replace(/\bno-top-border\b/g, '').replace(/\s+/g, ' ').trim()
})

// Lifecycle hooks
onMounted(async () => {
  await analyzeSlotChildren(null)
  await nextTick()
  
  // Register this component with the store if pagination mode is active
  console.log(`TrCrossPage ${componentId.value}: component mounted, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (paginationStore.isPaginationActive) {
    await registerWithStore()
  } else {
    console.log(`TrCrossPage ${componentId.value}: not registering - pagination 2 not active`)
  }

  
})

onUnmounted(() => {
  // Unregister this component from the store
  unregisterFromStore()
})

// No automatic watchers - updates are handled by the sequential update system

// Expose methods
defineExpose({
  getPosition,
  updateHeight,
  paginationOff,
  componentId: componentId.value,
  isCrossPage
})
</script>

<style scoped>
.spacer-row {
  border: none !important;
  background: transparent !important;
}

.spacer-cell {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  height: 100%;
}

.first-part {
  border-bottom: 1px solid #000;
}

.first-part td {
  vertical-align: top !important;
  overflow: hidden !important;
}

.second-part {
  border-top: 1px solid #000;
}

.second-part td {
  vertical-align: top !important;
}

.debug-indicator {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  user-select: none;
}

.debug-arrow {
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
}

.debug-text {
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  white-space: nowrap;
}

.custom-tooltip {
  position: absolute;
  background-color: #333;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 10000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  pointer-events: none;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #333;
}
</style>
