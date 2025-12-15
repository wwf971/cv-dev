<!-- IMPORTANT:
  list.vue should expand as multiple elements
  don't put an wrapper element
  -->
<template>
  <template v-for="(item, index) in contentArray" :key="index">
    
    <div v-if="typeof item === 'string'" class="content-item">
      <span v-if="containsMath(item)" class="content-text" v-html="processLatexMath(item)"></span>
      <span v-else class="content-text">{{ item }}</span>
    </div>
    
    <!-- Handle object content -->
    <template v-else-if="typeof item === 'object' && item !== null">
      <!-- Handle image type -->
      <div v-if="item.type === 'image'" class="content-item">
        <img-component
          :item="item"
        />
      </div>
      
      <!-- Handle other object types (can be extended) -->
      <div v-else class="content-item content-unknown">
        <span class="debug-info no-render">Unknown content type: {{ item.type || 'no type' }}</span>
        <pre class="debug-object">{{ JSON.stringify(item, null, 2) }}</pre>
      </div>
    </template>
    
    <!-- Handle other types -->
    <div v-else class="content-item content-unknown">
      <span class="debug-info no-render">Unsupported content type: {{ typeof item }}</span>
      <span class="debug-value">Value: {{ String(item) }}</span>
    </div>
  </template>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import ImgComponent from './img.vue'

// Define component name
defineOptions({
  name: 'ListComponent'
})

const props = defineProps({
  content: {
    type: [Array, String],
    required: true
  },
})

// Convert content to array format
const contentArray = computed(() => {
  if (typeof props.content === 'string') {
    return [props.content]
  } else if (Array.isArray(props.content)) {
    return props.content
  } else {
    console.warn('ListComponent: content is not a string or array:', props.content)
    return []
  }
})

// Math processing methods
const containsMath = (text) => {
  return /\$[^$]+\$/.test(text)
}

const processLatexMath = (text) => {
  // Replace $...$ patterns with span elements for better styling control
  return text.replace(/\$([^$]+)\$/g, '<span class="math-inline">$$$1$$</span>')
}

const rerenderMathJax = async () => {
  await nextTick()
  if (window.MathJax && window.MathJax.typesetPromise) {
    try {
      await window.MathJax.typesetPromise()
    } catch (err) {
      console.warn('MathJax typeset error:', err)
    }
  }
}

// Add debug logging to track when contentArray changes
watch(contentArray, (newVal, oldVal) => {
  console.log('🔄 ListComponent contentArray changed:', {
    oldLength: oldVal?.length || 0,
    newLength: newVal?.length || 0,
    content: newVal
  })
  
  // Re-render MathJax when content changes
  rerenderMathJax()
})

// Add lifecycle hooks for debugging
const componentId = `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

onMounted(() => {
  console.log(`🟢 ListComponent ${componentId} mounted with content:`, {
    contentLength: Array.isArray(props.content) ? props.content.length : 'not array',
    content: props.content
  })
  
  // Render MathJax on mount if content contains math
  rerenderMathJax()
})

onUnmounted(() => {
  console.log(`🔴 ListComponent ${componentId} unmounted`)
})
</script>

<style scoped>
.content-item {
  margin: 0 0 3px 0;  /* Fixed margin for predictable spacing */
  padding: 0;
  box-sizing: border-box;
  min-height: 19px;   /* Fixed minimum height based on font-size + line-height */
  display: flex;
  flex-direction: column;
}

.content-text {
  font-size: 14px;
  line-height: 1.4;  /* Fixed line height for predictable measurements */
  color: #333;
  display: block;
  margin: 0;
  padding: 0;
  white-space: pre-wrap;  /* Preserve leading spaces and allow wrapping */
}

.content-unknown {
  padding: 8px;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  font-size: 12px;
  color: #856404;
  margin: 0 0 3px 0;
  box-sizing: border-box;
}

/* General layout fixes for consistent measurements */
.content-item * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.content-item img {
  display: block;
  max-width: 100%;
  height: auto;
}

.debug-info {
  font-style: italic;
}

.debug-object {
  background-color: #f5f5f5;
  border: 1px solid #ccc;
  padding: 8px;
  margin: 4px 0;
  border-radius: 3px;
  font-size: 10px;
  overflow-x: auto;
}

.debug-value {
  display: block;
  margin-top: 4px;
  font-style: italic;
  color: #666;
}

/* Math rendering styles */
.math-inline {
  display: inline;
  font-family: 'Times New Roman', serif;
}

/* Ensure MathJax elements inherit text styling */
.content-text .MathJax {
  font-size: inherit !important;
  color: inherit !important;
}
</style>
