<template>
  <!-- Images container -->
  <div class="images-row" :style="containerStyle">
    <div 
      v-for="(src, index) in srcArray" 
      :key="index"
      class="image-item"
      :style="imageItemStyle"
      :ref="(el) => { if (el) imageItemRefs[index] = el }"
    >
      <img 
        :src="getImageUrl(src)"
        :alt="item.alt || `Image ${index + 1}`"
        :id="item.id ? `${item.id}-${index}` : undefined"
        class="content-image"
        :style="multiImageStyle"
        :ref="(el) => { if (el) imageRefs[index] = el }"
        @load="() => onImageLoad(index)"
        @error="() => onImageError(index)"
      />
    </div>
  </div>
  
  <!-- Individual captions container (if captionForEachImage is true) -->
  <div v-if="captionForEachImage && caption" class="captions-row">
    <div 
      v-for="(captionText, index) in caption" 
      :key="index"
      class="caption-item"
      :style="getCaptionItemStyle(index)"
    >
      <div class="individual-image-caption" v-html="captionText">
      </div>
    </div>
  </div>
  
  <!-- Single caption for all images (if captionForEachImage is false) -->
  <div v-if="!captionForEachImage && caption" class="image-caption" v-html="caption">
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useInfoStore } from '@/content/info.js'
const infoStore = useInfoStore()

// Define component name
defineOptions({
  name: 'ImgComponent'
})

const captionForEachImage = ref(false);
const caption = computed(() => {
  // console.log('ImgComponent: caption:', props.item.caption)
  if (!props.item.caption) return null
  
  if (typeof props.item.caption === 'string') {
    captionForEachImage.value = false
    return props.item.caption
  } else if (Array.isArray(props.item.caption)) {
    // Check if caption array length matches image array length
    if (props.item.caption.length === srcArray.value.length) {
      captionForEachImage.value = true
      return props.item.caption
    } else {
      // Return error messages if lengths don't match
      captionForEachImage.value = true
      return Array(srcArray.value.length).fill(
        `Error: Caption count (${props.item.caption.length}) doesn't match image count (${srcArray.value.length})`
      )
    }
  }
  
  captionForEachImage.value = false
  return null
})

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  info: {
    type: [Object, String, Number, Boolean],
    required: false,
    default: undefined
  }
})

// Reactive data
const imageLoaded = ref({})
const imageRefs = ref([])
const imageItemRefs = ref([])
const actualImageWidths = ref({})

// Computed styles
const containerStyle = computed(() => {
  const style = {}
  if (props.item.width) {
    style.width = props.item.width
  }
  // Remove height from container - it should only apply to images
  return style
})

// Convert src to array (single string becomes single-element array)
const srcArray = computed(() => {
  return Array.isArray(props.item.src) ? props.item.src : [props.item.src]
})

// Image item style (for flexbox layout)
const imageItemStyle = computed(() => {
  const imageCount = srcArray.value.length
  return {
    // Let images size naturally without width constraints
  }
})

const multiImageStyle = computed(() => {
  const style = {}
  // For images, adjust sizing
  if (props.item.height) {
    style.height = props.item.height
  }
  style.objectFit = props.item.objectFit || 'contain'
  // Remove width: 100% to let images size naturally based on aspect ratio
  // style.width = '100%'
  return style
})

// Method to get the full image URL
const getImageUrl = (src) => {
  return `${infoStore.server_url}${src}`
}

// Methods
// Method to get style for individual caption items
const getCaptionItemStyle = (index) => {
  const width = actualImageWidths.value[index]
  
  if (!width) {
    return {}
  }
  
  return {
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`
  }
}

// Method to measure and store actual image widths
const updateCaptionWidths = () => {
  srcArray.value.forEach((src, index) => {
    const imageRef = imageRefs.value[index]
    if (imageRef && imageLoaded.value[index]) {
      const width = imageRef.offsetWidth
      if (width > 0) {
        actualImageWidths.value[index] = width
        // console.log(`ImgComponent: Measured image ${index} width: ${width}px`)
      }
    }
  })
}

// Image event handlers
const onImageLoad = (index) => {
  imageLoaded.value[index] = true
  // console.log(`ImgComponent: Image ${index} loaded successfully`)
  // Update caption widths after image loads
  nextTick(() => {
    updateCaptionWidths()
  })
}

const onImageError = (index) => {
  imageLoaded.value[index] = false
  console.error(`ImgComponent: Image ${index} failed to load`)
}



// Watch for loaded images to update caption widths
watch(imageLoaded, () => {
  nextTick(() => {
    updateCaptionWidths()
  })
}, { deep: true })

// Watch for changes in actual image widths to trigger re-renders
watch(actualImageWidths, () => {
  // This will trigger reactivity when widths are updated
}, { deep: true })

// No need for onMounted since images are loaded directly via URLs
</script>

<style scoped>
.images-row {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: flex-start;
  justify-content: center;
  margin: 3px 0;
  padding: 0;
  position: relative;
  min-height: 100px;
  box-sizing: border-box;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.captions-row {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: flex-start;
  justify-content: center;
  margin: 0;
  padding: 0;
}

.caption-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.content-image {
  max-width: 100%;
  height: auto;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  padding: 20px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
  color: #666;
  font-size: 14px;
  text-align: center;
}

.image-placeholder.loading {
  background-color: #f0f8ff;
  border-color: #87ceeb;
  color: #4682b4;
}

.image-placeholder.error {
  background-color: #ffe6e6;
  border-color: #ff9999;
  color: #cc0000;
}

.image-placeholder.no-src {
  background-color: #fff3cd;
  border-color: #ffeaa7;
  color: #856404;
}

.image-caption {
  width: 90%;
  margin: 8px auto 0 auto;
  text-align: center;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
  align-self: center;
}

.individual-image-caption {
  width: 100%;
  margin: 8px auto 0 auto;
  text-align: center;
  color: #666;
  font-size: 13px;
  line-height: 1.4;
  padding: 0 5px;
  box-sizing: border-box;
}
</style>
