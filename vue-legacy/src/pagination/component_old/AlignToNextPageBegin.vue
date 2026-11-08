<template>
  <div 
    ref="alignDiv"
    class="align-to-next-page-begin cross-page no-render"
    :style="{ height: currentHeight + 'px' }"
  >
    <!-- This div forces a page break by expanding to next page begin -->
    <div v-if="showDebugInfo" class="debug-info no-render">
      <small>
        Current Y: {{ currentY.toFixed(0) }}px<br>
        Next Page Begin: {{ nextPageBeginY ? nextPageBeginY.toFixed(0) + 'px' : 'None' }}<br>
        Current Height: {{ currentHeight.toFixed(0) }}px<br>
        In Page Gap: {{ isInPageGap ? 'Yes' : 'No' }}
      </small>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { usePaginationStore } from '@/panels/paginationStore.js'

// Define component name
defineOptions({
  name: 'AlignToNextPageBegin'
})

// Props
const props = defineProps({
  showDebugInfo: {
    type: Boolean,
    default: false
  },
  minHeight: {
    type: Number,
    default: 0
  }
})

// Refs
const alignDiv = ref(null)
const currentY = ref(0)
const currentHeight = ref(props.minHeight)
const isInPageGap = ref(false)
const componentId = ref(`align-next-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

// Store
const paginationStore = usePaginationStore()

// Watch for pagination mode changes
watch(
  () => paginationStore.isPaginationActive,
  (isActive, wasActive) => {
    console.log(`AlignToNextPageBegin ${componentId.value}: pagination mode changed from ${wasActive} to ${isActive}`)
    if (isActive && !wasActive) {
      // Mode turned on - register component
      console.log(`AlignToNextPageBegin ${componentId.value}: registering component`)
      registerWithStore()
    } else if (!isActive && wasActive) {
      // Mode turned off - unregister component and reset state
      console.warn(`AlignToNextPageBegin ${componentId.value}: unregistering component and resetting state`)
      unregisterFromStore()
      // Force reset state
      currentHeight.value = props.minHeight
      isInPageGap.value = false
    }
  }
)

// Computed properties
const nextPageBeginY = computed(() => {
  const nextPageBeginY = paginationStore.getNextPageBeginLineYSync(currentY.value)
  return nextPageBeginY;
})

const updatePosition = () => {
  const self_top = alignDiv.value.getBoundingClientRect().top + window.scrollY
  currentY.value = self_top;
}

// Methods
const updateHeight = async () => {
  if (!alignDiv.value) return
  
  // Get the current position of this div relative to the container
  const page_container = document.querySelector('.pagination-container')
  const page_container_top = page_container.getBoundingClientRect().top + window.scrollY
  if (!page_container) {
    console.log('AlignToNextPageBegin: .page_a4_width container not found')
    return
  }
  const self_top = alignDiv.value.getBoundingClientRect().top + window.scrollY

  console.warn('AlignToNextPageBegin: page_container_top', page_container_top)

  let nextPageBeginLineEl = paginationStore.findNextPageBeginLineEl(self_top)
  if(nextPageBeginLineEl === null){
    paginationStore.appendPageLines()
    await nextTick()
    await nextTick()
    nextPageBeginLineEl = paginationStore.findNextPageBeginLineEl(self_top)
    if(nextPageBeginLineEl === null){
      console.error('AlignToNextPageBegin: nextPageBeginLineEl not found')
      return
    }
  }
  console.warn('AlignToNextPageBegin: nextPageBeginLineEl found')
  const page_line_begin_next_top = nextPageBeginLineEl.getBoundingClientRect().top + window.scrollY

  console.warn('AlignToNextPageBegin: page_line_begin_next_top', page_line_begin_next_top)
  console.warn('AlignToNextPageBegin: self_top', self_top)
  // wait for 10 seconds
  // await new Promise(resolve => setTimeout(resolve, 20000))
  const height = page_line_begin_next_top - self_top;
  console.warn('AlignToNextPageBegin: height', height)
  currentHeight.value = height;
}

const checkIfInPageGap = () => {
  // Check if current position is in a page gap (after a page end line)
  const allPageLines = paginationStore.pageLines
  const pageEndLines = allPageLines.filter(line => line.type === 'end')
  
  // Find the last page end line before current position
  const lastPageEndBefore = pageEndLines
    .filter(line => line.y <= currentY.value)
    .sort((a, b) => b.y - a.y)[0] // Get the closest one before current position
  
  if (!lastPageEndBefore) {
    // No page end line before current position, so we're in the first page
    isInPageGap.value = false
    return
  }
  
  // Find the next page begin line after the last page end
  const nextPageBeginAfterEnd = allPageLines
    .filter(line => line.type === 'begin' && line.y > lastPageEndBefore.y)
    .sort((a, b) => a.y - b.y)[0] // Get the closest one after the page end
  
  if (!nextPageBeginAfterEnd) {
    // No page begin after the last page end, so we're after the last page
    isInPageGap.value = true
    return
  }
  
  // Check if current position is between page end and next page begin (in gap)
  isInPageGap.value = currentY.value > lastPageEndBefore.y && currentY.value < nextPageBeginAfterEnd.y
  
  // console.log('AlignToNextPageBegin gap check:', {
  //   currentY: currentY.value,
  //   lastPageEndBefore: lastPageEndBefore ? lastPageEndBefore.y : null,
  //   nextPageBeginAfterEnd: nextPageBeginAfterEnd ? nextPageBeginAfterEnd.y : null,
  //   isInPageGap: isInPageGap.value
  // })
}

// Exposed methods for the store to call
const getPosition = () => {
  const self_top = alignDiv.value.getBoundingClientRect().top + window.scrollY
  console.log(`AlignToNextPageBegin ${componentId.value}: getPosition() = ${self_top.toFixed(1)}`)
  currentY.value = self_top
  return self_top
}

// Method to reset component to non-pagination state
const paginationOff = () => {
  console.log(`AlignToNextPageBegin ${componentId.value}: paginationOff() called`)
  
  // Reset to minimum height
  currentHeight.value = props.minHeight
  
  // Clear cached state
  currentY.value = 0
  isInPageGap.value = false
  
  // Remove any additional styling that might have been applied
  if (alignDiv.value) {
    alignDiv.value.style.height = `${props.minHeight}px`
  }
  
  console.log(`AlignToNextPageBegin ${componentId.value}: reset to non-pagination state (height: ${props.minHeight}px)`)
}

// Component registration methods
const registerWithStore = async () => {
  console.log(`AlignToNextPageBegin ${componentId.value}: attempting to register, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (!paginationStore.isPaginationActive) {
    console.log(`AlignToNextPageBegin ${componentId.value}: skipping registration - pagination 2 not active`)
    return
  }
  
  // Check if already registered
  if (paginationStore.registeredComponents.has(componentId.value)) {
    console.log(`AlignToNextPageBegin ${componentId.value}: already registered, skipping`)
    return
  }
  
  const componentInstance = {
    getPosition,
    updateHeight,
    paginationOff,
    componentId: componentId.value
  }
  paginationStore.registerComponent(componentId.value, componentInstance, 'AlignToNextPageBegin')
  console.log(`AlignToNextPageBegin ${componentId.value}: successfully registered with store`)
  
  // DON'T call updateHeight() immediately - let the sequential update handle it
  console.log(`AlignToNextPageBegin ${componentId.value}: registered, waiting for sequential update`)
}

const unregisterFromStore = () => {
  console.log(`AlignToNextPageBegin ${componentId.value}: unregistering from store`)
  paginationStore.unregisterComponent(componentId.value)
  
  // Reset component state when unregistering
  currentHeight.value = props.minHeight
  isInPageGap.value = false
  console.log(`AlignToNextPageBegin ${componentId.value}: unregistered and reset state`)
}

// Lifecycle hooks
onMounted(async () => {
  await nextTick()
  currentY.value = alignDiv.value.getBoundingClientRect().top + window.scrollY
  // Register this component with the store if pagination mode is active
  console.log(`AlignToNextPageBegin ${componentId.value}: component mounted, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (paginationStore.isPaginationActive) {
    await registerWithStore()
  } else {
    // console.log(`AlignToNextPageBegin ${componentId.value}: not registering - pagination 2 not active`)
  }
})

onUnmounted(() => {
  // Unregister this component from the store
  unregisterFromStore()
})

// Note: Removed automatic watcher to prevent infinite update loops
// Components are updated via the sequential update system instead

// Expose methods for parent components if needed
defineExpose({
  getPosition,
  updateHeight,
  paginationOff,
  componentId: componentId.value
})
</script>

<style scoped>
.align-to-next-page-begin {
  width: 100%;
  background-color: rgba(0, 255, 255, 0.1); /* Light cyan background for debugging */
  border: 1px dashed rgba(0, 255, 255, 0.5);
  box-sizing: border-box;
  position: relative;
  min-height: 20px;
}

.debug-info {
  position: absolute;
  top: 2px;
  left: 2px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 10px;
  color: #666;
  line-height: 1.2;
  z-index: 100;
}

/* Hide the visual styling in production */
.align-to-next-page-begin.no-debug {
  background-color: transparent;
  border: none;
}
</style>