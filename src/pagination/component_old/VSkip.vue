<template>
  <div 
    ref="skipDiv"
    class="v-skip cross-page no-render"
    :style="{ height: currentHeight + 'px' }"
  >
    <!-- Debug info when enabled -->
    <div v-if="showDebugInfo" class="debug-info no-render">
      <small>
        Mode: {{ isAlignMode ? 'Align to Next Page' : 'Fixed Height' }}<br>
        Desired Height: {{ height }}px<br>
        Current Height: {{ currentHeight.toFixed(0) }}px<br>
        Current Y: {{ currentY.toFixed(0) }}px<br>
        <template v-if="!isAlignMode">
          Distance to Page End: {{ distanceToPageEnd ? distanceToPageEnd.toFixed(0) + 'px' : 'N/A' }}
        </template>
        <template v-if="isAlignMode">
          Next Page Begin: {{ nextPageBeginY ? nextPageBeginY.toFixed(0) + 'px' : 'N/A' }}
        </template>
      </small>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { usePaginationStore } from '@/panels/paginationStore.js'

// Define component name
defineOptions({
  name: 'VSkip'
})

// Props
const props = defineProps({
  height: {
    type: Number,
    required: true,
    validator: (value) => value > 0
  },
  showDebugInfo: {
    type: Boolean,
    default: false
  }
})

// Refs
const skipDiv = ref(null)
const currentY = ref(0)
const currentHeight = ref(props.height)
const isAlignMode = ref(false)
const distanceToPageEnd = ref(null)
const componentId = ref(`vskip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

// Store
const paginationStore = usePaginationStore()

// Watch for pagination mode changes
watch(
  () => paginationStore.isPaginationActive,
  (isActive, wasActive) => {
    console.log(`VSkip ${componentId.value}: pagination mode changed from ${wasActive} to ${isActive}`)
    if (isActive && !wasActive) {
      // Mode turned on - register component
      console.log(`VSkip ${componentId.value}: registering component`)
      registerWithStore()
    } else if (!isActive && wasActive) {
      // Mode turned off - unregister component and reset state
      console.warn(`VSkip ${componentId.value}: unregistering component and resetting state`)
      unregisterFromStore()
      // Force reset state
      currentHeight.value = props.height
      isAlignMode.value = false
      distanceToPageEnd.value = null
    }
  }
)

// Computed properties
const nextPageBeginY = computed(() => {
  if (!isAlignMode.value) return null
  return paginationStore.getNextPageBeginLineYSync(currentY.value)
})

// Methods
const updatePosition = () => {
  if (!skipDiv.value) return
  const self_top = skipDiv.value.getBoundingClientRect().top + window.scrollY
  currentY.value = self_top
}

const calculateDistanceToPageEnd = () => {
  if (!skipDiv.value) return null
  
  const self_top = skipDiv.value.getBoundingClientRect().top + window.scrollY
  const pageEndLineEl = paginationStore.findNextPageEndLineEl(self_top)
  
  if (!pageEndLineEl) {
    return null // No page end line found
  }
  
  const pageEndY = pageEndLineEl.getBoundingClientRect().top + window.scrollY
  return pageEndY - self_top
}

const updateHeight = async () => {
  if (!skipDiv.value) return
  
  updatePosition()
  
  // Calculate distance to next page end line
  distanceToPageEnd.value = calculateDistanceToPageEnd()
  
  if (distanceToPageEnd.value === null) {
    // No page end line found, use fixed height
    currentHeight.value = props.height
    isAlignMode.value = false
    console.log(`VSkip ${componentId.value}: No page end line found, using fixed height ${props.height}px`)
    return
  }
  
  // Check if distance to page end is smaller than desired height
  if (distanceToPageEnd.value < props.height) {
    // Switch to align mode - expand to next page begin
    isAlignMode.value = true
    await calculateAlignHeight()
    console.log(`VSkip ${componentId.value}: Distance to page end (${distanceToPageEnd.value.toFixed(1)}px) < desired height (${props.height}px), switching to align mode`)
  } else {
    // Use fixed height
    isAlignMode.value = false
    currentHeight.value = props.height
    console.log(`VSkip ${componentId.value}: Using fixed height ${props.height}px (distance to page end: ${distanceToPageEnd.value.toFixed(1)}px)`)
  }
}

const calculateAlignHeight = async () => {
  if (!skipDiv.value) return
  
  const self_top = skipDiv.value.getBoundingClientRect().top + window.scrollY
  
  let nextPageBeginLineEl = paginationStore.findNextPageBeginLineEl(self_top)
  if (nextPageBeginLineEl === null) {
    paginationStore.appendPageLines()
    await nextTick()
    await nextTick()
    nextPageBeginLineEl = paginationStore.findNextPageBeginLineEl(self_top)
    if (nextPageBeginLineEl === null) {
      console.error('VSkip: nextPageBeginLineEl not found')
      return
    }
  }
  
  const pageLineBeginNextTop = nextPageBeginLineEl.getBoundingClientRect().top + window.scrollY
  const height = pageLineBeginNextTop - self_top
  
  currentHeight.value = Math.max(height, 0) // Ensure non-negative height
  console.log(`VSkip ${componentId.value}: Calculated align height: ${height.toFixed(1)}px`)
}

// Exposed methods for the store to call
const getPosition = () => {
  if (!skipDiv.value) return 0
  const self_top = skipDiv.value.getBoundingClientRect().top + window.scrollY
  console.log(`VSkip ${componentId.value}: getPosition() = ${self_top.toFixed(1)}`)
  currentY.value = self_top
  return self_top
}

// Method to reset component to non-pagination state
const paginationOff = () => {
  console.log(`VSkip ${componentId.value}: paginationOff() called`)
  
  // Reset to fixed height
  currentHeight.value = props.height
  isAlignMode.value = false
  distanceToPageEnd.value = null
  
  // Clear cached state
  currentY.value = 0
  
  // Remove any additional styling that might have been applied
  if (skipDiv.value) {
    skipDiv.value.style.height = `${props.height}px`
  }
  
  console.log(`VSkip ${componentId.value}: reset to non-pagination state (height: ${props.height}px)`)
}

// Component registration methods
const registerWithStore = async () => {
  console.log(`VSkip ${componentId.value}: attempting to register, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (!paginationStore.isPaginationActive) {
    console.log(`VSkip ${componentId.value}: skipping registration - pagination 2 not active`)
    return
  }
  
  // Check if already registered
  if (paginationStore.registeredComponents.has(componentId.value)) {
    console.log(`VSkip ${componentId.value}: already registered, skipping`)
    return
  }
  
  const componentInstance = {
    getPosition,
    updateHeight,
    paginationOff,
    componentId: componentId.value
  }
  paginationStore.registerComponent(componentId.value, componentInstance, 'VSkip')
  console.log(`VSkip ${componentId.value}: successfully registered with store`)
  
  // DON'T call updateHeight() immediately - let the sequential update handle it
  console.log(`VSkip ${componentId.value}: registered, waiting for sequential update`)
}

const unregisterFromStore = () => {
  console.log(`VSkip ${componentId.value}: unregistering from store`)
  paginationStore.unregisterComponent(componentId.value)
  
  // Reset component state when unregistering
  currentHeight.value = props.height
  isAlignMode.value = false
  distanceToPageEnd.value = null
  console.log(`VSkip ${componentId.value}: unregistered and reset state`)
}

// Lifecycle hooks
onMounted(async () => {
  await nextTick()
  if (skipDiv.value) {
    currentY.value = skipDiv.value.getBoundingClientRect().top + window.scrollY
  }
  
  // Register this component with the store if pagination mode is active
  console.log(`VSkip ${componentId.value}: component mounted, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (paginationStore.isPaginationActive) {
    await registerWithStore()
  } else {
    // Use fixed height when pagination is not active
    currentHeight.value = props.height
  }
})

onUnmounted(() => {
  // Unregister this component from the store
  unregisterFromStore()
})

// Expose methods for parent components if needed
defineExpose({
  getPosition,
  updateHeight,
  paginationOff,
  componentId: componentId.value,
  isAlignMode
})
</script>

<style scoped>
.v-skip {
  width: 100%;
  /* Invisible by default */
  background-color: transparent;
  border: none;
  box-sizing: border-box;
  position: relative;
}

/* Debug mode styling */
.v-skip.debug {
  background-color: rgba(255, 165, 0, 0.1); /* Light orange background for debugging */
  border: 1px dashed rgba(255, 165, 0, 0.5);
}

.debug-info {
  position: absolute;
  top: 2px;
  left: 2px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 10px;
  color: #666;
  line-height: 1.3;
  z-index: 100;
  border: 1px solid #ddd;
  max-width: 200px;
}
</style>
