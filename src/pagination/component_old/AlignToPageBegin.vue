<template>
  <div 
    ref="alignDiv"
    class="align-to-page-begin cross-page no-render"
    :style="{ height: currentHeight + 'px' }"
  >
    <!-- This div has no content but adjusts its height to align with next page begin -->
    <div v-if="showDebugInfo" class="debug-info no-render">
              <small> <!-- smaller font size-->
          Current Y: {{ currentY.toFixed(0) }}px<br>
          Next Page Begin: {{ nextPageBeginY ? nextPageBeginY.toFixed(0) + 'px' : 'None' }}<br>
          Current Height: {{ currentHeight.toFixed(0) }}px
        </small>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { usePaginationStore } from '@/panels/paginationStore.js'

// Define component name
defineOptions({
  name: 'AlignToPageBegin'
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
const componentId = ref(`align-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

// Store
const paginationStore = usePaginationStore()

// Computed properties
const nextPageBeginY = computed(() => {
  const nextBeginY = paginationStore.getNextPageBeginLineYSync(currentY.value)
  console.warn(`nextPageBeginY: currentY: ${currentY.value} nextBeginY: ${nextBeginY}`)

  return nextBeginY;
})

// Watch for pagination mode changes
watch(
  () => paginationStore.isPaginationActive,
  (isActive, wasActive) => {
    console.log(`AlignToPageBegin ${componentId.value}: pagination mode changed from ${wasActive} to ${isActive}`)
    if (isActive && !wasActive) {
      // Mode turned on - register component
      console.log(`AlignToPageBegin ${componentId.value}: registering component`)
      registerWithStore()
    } else if (!isActive && wasActive) {
      // Mode turned off - unregister component and reset state
      console.log(`AlignToPageBegin ${componentId.value}: unregistering component and resetting state`)
      unregisterFromStore()
      // Force reset state
      currentHeight.value = props.minHeight
    }
  }
)

// Methods
const updatePosition = () => {
  if (!alignDiv.value) return
  const self_top = alignDiv.value.getBoundingClientRect().top + window.scrollY
  currentY.value = self_top
}

// Exposed methods for the store to call
const getPosition = () => {
  updatePosition()
  return currentY.value
}

const updateHeight = async () => {
  await nextTick()
  const self_top = alignDiv.value.getBoundingClientRect().top + window.scrollY
  
  let nextPageBeginLineEl = paginationStore.findNextPageBeginLineEl(self_top)
  if(!nextPageBeginLineEl){
    paginationStore.appendPageLines()
    await nextTick()
    await nextTick()
    nextPageBeginLineEl = paginationStore.findNextPageBeginLineEl(self_top)
    if(!nextPageBeginLineEl){
      console.error('updateHeight: nextPageBeginLineEl not found')
    }
    return
  }
  const page_line_begin_next_top = nextPageBeginLineEl.getBoundingClientRect().top + window.scrollY
  // Calculate height needed to align bottom with next page begin
  currentHeight.value = page_line_begin_next_top - self_top
}

// Method to reset component to non-pagination state
const paginationOff = () => {
  console.log(`AlignToPageBegin ${componentId.value}: paginationOff() called`)
  
  // Reset to minimum height
  currentHeight.value = props.minHeight
  
  // Clear any cached position
  currentY.value = 0
  
  // Remove any additional styling that might have been applied
  if (alignDiv.value) {
    alignDiv.value.style.height = `${props.minHeight}px`
  }
  
  console.log(`AlignToPageBegin ${componentId.value}: reset to non-pagination state (height: ${props.minHeight}px)`)
}

// Component registration methods
const registerWithStore = async () => {
  console.log(`AlignToPageBegin ${componentId.value}: attempting to register, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (!paginationStore.isPaginationActive) {
    // console.log(`AlignToPageBegin ${componentId.value}: skipping registration - pagination 2 not active`)
    return
  }
  
  // Check if already registered
  if (paginationStore.registeredComponents.has(componentId.value)) {
    console.log(`AlignToPageBegin ${componentId.value}: already registered, skipping`)
    return
  }
  
  const componentInstance = {
    getPosition,
    updateHeight,
    paginationOff,
    componentId: componentId.value
  }
  paginationStore.registerComponent(componentId.value, componentInstance, 'AlignToPageBegin')
  console.log(`AlignToPageBegin ${componentId.value}: successfully registered with store`)
  
  // DON'T call updateHeight() immediately - let the sequential update handle it
  console.log(`AlignToPageBegin ${componentId.value}: registered, waiting for sequential update`)
}

const unregisterFromStore = () => {
  console.log(`AlignToPageBegin ${componentId.value}: unregistering from store`)
  paginationStore.unregisterComponent(componentId.value)
  
  // Reset component state when unregistering
  currentHeight.value = props.minHeight
  console.log(`AlignToPageBegin ${componentId.value}: unregistered and reset state`)
}

// Lifecycle hooks
onMounted(async () => {
  await nextTick()
  
  // Register this component with the store if pagination mode is active
  console.log(`AlignToPageBegin ${componentId.value}: component mounted, isPaginationActive = ${paginationStore.isPaginationActive}`)
  if (paginationStore.isPaginationActive) {
    await registerWithStore()
  } else {
    console.log(`AlignToPageBegin ${componentId.value}: not registering - pagination 2 not active`)
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
.align-to-page-begin {
  width: 100%;
  background-color: rgba(255, 255, 0, 0.1); /* Very light yellow background for debugging */
  border: 1px dashed rgba(255, 255, 0, 0.3);
  box-sizing: border-box;
  position: relative;
  min-height: 20px;
}

.debug-info {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 10px;
  color: #666;
  line-height: 1.2;
  z-index: 100;
}

/* Hide the visual styling in production */
.align-to-page-begin.no-debug {
  background-color: transparent;
  border: none;
}
</style>
