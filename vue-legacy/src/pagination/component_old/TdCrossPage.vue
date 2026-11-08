<template>
  <td 
    ref="tdRef"
    :class="tdClass"
    :colspan="colspan"
    :rowspan="rowspan"
    v-bind="$attrs"
  >
    <!-- vText content rendering -->
    <template v-if="hasVText">
      <span v-html="formatText(fullText)"></span>
    </template>
    
    <!-- Slot content rendering -->
    <template v-else-if="hasSlots || props.slotContent">
      <!-- Render preserved slot content if available -->
      <template v-if="props.slotContent">
        <template v-if="typeof props.slotContent === 'function'">
          <template v-for="(vnode, index) in processedSlotVNodes" :key="`slot-${index}`">
            <component :is="vnode" />
          </template>
        </template>
        <template v-else-if="Array.isArray(props.slotContent)">
          <template v-for="(preservedSlot, index) in props.slotContent" :key="`preserved-${index}`">
            <component :is="preservedSlot" />
          </template>
        </template>
      </template>
      
      <!-- Fallback to original slots if no preserved content -->
      <template v-else>
        <slot />
      </template>
    </template>
  </td>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, useSlots, h, provide, watch } from 'vue'

// Define component name
defineOptions({
  name: 'TdCrossPage',
  inheritAttrs: false
})

// Props
const props = defineProps({
  tdClass: {
    type: String,
    default: ''
  },
  colspan: {
    type: [String, Number],
    default: 1
  },
  rowspan: {
    type: [String, Number],
    default: 1
  },
  vText: {
    type: String,
    default: ''
  },
  slotContent: {
    type: [Array, Function],
    default: null
  }
})

// Slots
const slots = useSlots()

// Check content type and warn if both are provided
const hasVText = computed(() => Boolean(props.vText && props.vText.trim()))
const hasSlots = computed(() => Boolean(slots.default || props.slotContent))

// Log slot content and warn about conflicts
const analyzeContent = () => {
  if (hasSlots.value) {
    if (slots.default) {
      console.log('TdCrossPage slots detected:', slots.default?.())
    } else if (props.slotContent) {
      console.log('TdCrossPage preserved slots detected:', typeof props.slotContent)
    }
  }
  
  if (hasVText.value && hasSlots.value) {
    const slotInfo = slots.default ? slots.default?.() : 'preserved content'
    console.log('TdCrossPage: Both vText and slots provided. Only one content type should be used.', {
      vText: props.vText,
      slots: slotInfo
    })
  }
}

// Refs
const tdRef = ref(null)
const fullText = ref(props.vText)

// Process slot function to get vnodes for template rendering
const processedSlotVNodes = computed(() => {
  if (typeof props.slotContent === 'function') {
    try {
      const vnodes = props.slotContent()
      return Array.isArray(vnodes) ? vnodes : [vnodes]
    } catch (error) {
      console.error('Error calling slotContent function:', error)
      return []
    }
  }
  return []
})

// Helper function to format text with line breaks
const formatText = (text) => {
  if (!text) return ''
  return text.replace(/\n/g, '<br>')
}

// Methods
const getRect = () => {
  return tdRef.value?.getBoundingClientRect() || null
}



// Initialize
onMounted(async () => {
  fullText.value = props.vText
  
  // Analyze content type
  analyzeContent()
})

// Watch for vText changes
watch(() => props.vText, (newText) => {
  fullText.value = newText
  // Re-analyze content when vText changes
  analyzeContent()
})

// Expose methods
defineExpose({
  getRect,
  fullText,
  hasVText,
  hasSlots,
  processedSlotVNodes
})
</script>

<style scoped>
/* Inherit styles from parent */

.height-constrained-content {
  height: 100%;
  max-height: 100%;
  overflow: hidden !important;
  position: relative;
  box-sizing: border-box;
  /* Force content to be clipped */
  display: block;
  /* Ensure it respects parent height constraints */
  word-wrap: break-word;
}

/* Ensure proper height inheritance in split mode */
td {
  height: inherit;
  max-height: inherit;
  overflow: inherit;
}

/* Second part content styling */
.second-part-content {
  position: relative;
  overflow: visible;
}
</style>
