<template>
  <div ref="imageWrapperRef" class="image-wrapper">
    <div 
      v-if="imageState.state === 'pending'" 
      class="image-placeholder pending"
      :style="placeholderStyle"
    >
      <span>Data fetching has not started⋯</span>
    </div>
    
    <div 
      v-else-if="imageState.state === 'loading'" 
      class="image-placeholder loading"
      :style="placeholderStyle"
    >
      <span>Loading...</span>
    </div>
    
    <div 
      v-else-if="imageState.state === 'error'" 
      class="image-placeholder error"
      :style="placeholderStyle"
    >
      <span>✗</span>
    </div>
    
    <img 
      v-else
      ref="imageRef"
      :src="imageState.data"
      :style="imageStyle"
      class="content-image"
      draggable="false"
      @load="onImageLoad"
    />
    
    <div 
      v-if="caption || imageState.state === 'error'" 
      class="image-caption"
      :class="{ 'error-caption': imageState.state === 'error' }"
      :style="captionStyle"
    >
      <template v-if="imageState.state === 'error'">
        <div class="error-title">Failed to load image</div>
        <div class="error-source">{{ src }}</div>
        <div v-if="caption" class="error-original-caption">{{ caption }}</div>
      </template>
      <template v-else>
        {{ caption }}
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import { useImageDataStore } from '@/remote/imageDataStore.js'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  width: {
    type: String,
    default: null
  },
  height: {
    type: String,
    default: null
  },
  caption: {
    type: String,
    default: null
  },
  captionSizeStrategy: {
    type: String,
    default: 'sameWidth',
    validator: (value) => ['sameWidth', 'natural'].includes(value)
  }
})

const imageWrapperRef = ref(null)
const imageRef = ref(null)
const imageDataStore = useImageDataStore()
const actualImageWidth = ref(null)
const logger = inject('paginationLogger', null)
const shouldFetch = inject('shouldFetchImages', ref(true))

const imageState = computed(() => {
  if (!shouldFetch.value) {
    return {
      state: 'pending',
      data: null,
      message: null
    }
  }
  return imageDataStore.getImage(props.src)
})

const placeholderStyle = computed(() => {
  const style = {}
  
  if (props.width && props.height) {
    style.width = props.width
    style.height = props.height
  } else if (props.width) {
    style.width = props.width
    style.height = props.width
  } else if (props.height) {
    style.height = props.height
    style.width = props.height
  } else {
    style.width = '200px'
    style.height = '200px'
  }
  
  return style
})

const imageStyle = computed(() => {
  const style = {}
  
  if (props.width && props.height) {
    style.width = props.width
    style.height = props.height
    style.objectFit = 'fill'
  } else if (props.width) {
    style.width = props.width
    style.height = 'auto'
  } else if (props.height) {
    style.height = props.height
    style.width = 'auto'
  } else {
    style.maxWidth = '100%'
    style.height = 'auto'
  }
  
  return style
})

const captionStyle = computed(() => {
  if (props.captionSizeStrategy === 'sameWidth' && actualImageWidth.value) {
    return {
      maxWidth: `${actualImageWidth.value}px`,
      width: '100%'
    }
  }
  return {}
})

const onImageLoad = () => {
  if (imageRef.value) {
    actualImageWidth.value = imageRef.value.offsetWidth
    if (logger) {
      logger.addLog(`Image loaded, width: ${actualImageWidth.value}px`, 'Image.onImageLoad')
    }
  }
}

watch(() => imageState.value.state, (newState) => {
  if (newState === 'loaded' && imageRef.value) {
    setTimeout(() => {
      actualImageWidth.value = imageRef.value.offsetWidth
    }, 0)
  } else if (newState === 'error') {
    const errorMsg = imageState.value.message || 'Unknown error'
    if (logger) {
      logger.addLog(`Image fetch failed: ${props.src} - ${errorMsg}`, 'Image.watch', 'Error')
    }
  }
})

const trySplit = (pageContext, docContext) => {
  if (!imageWrapperRef.value || !docContext || !pageContext) {
    if (logger) {
      logger.addLog('Error - missing refs or contexts', 'Image.trySplit', 'Error')
    }
    return {
      code: -1,
      data: null
    }
  }

  if (logger) {
    logger.addLog('Starting split analysis for image', 'Image.trySplit')
  }

  const wrapperBottom = docContext.measureVerticalPosEnd(imageWrapperRef.value)
  const wrapperTop = docContext.measureVerticalPos(imageWrapperRef.value)
  const pageBottomY = pageContext.pageBottomY

  if (logger) {
    logger.addLog(`Image wrapper top: ${wrapperTop}, bottom: ${wrapperBottom}, page bottom: ${pageBottomY}`, 'Image.trySplit')
  }

  // Image + caption fit on current page
  if (wrapperBottom <= pageBottomY) {
    if (logger) {
      logger.addLog('Image fits on current page, no split needed', 'Image.trySplit')
    }
    return {
      code: 0,
      data: null
    }
  }

  // Image + caption exceed page bottom, move entire component to next page
  if (logger) {
    logger.addLog('Image exceeds page bottom, moving to next page', 'Image.trySplit')
  }
  return {
    code: 2,
    data: null
  }
}

defineExpose({
  trySplit
})
</script>

<style scoped>
.image-wrapper {
  display: inline-block;
  vertical-align: top;
  margin: 0;
  padding: 0;
}

.content-image {
  display: block;
  max-width: 100%;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ccc;
  border-radius: 2px;
  box-sizing: border-box;
  font-size: 12px;
  text-align: center;
  padding: 8px;
}

.image-placeholder.pending {
  background-color: #f0f8ff;
  border-color: #ccc;
  color: #666;
  font-size: 10px;
  font-weight: normal;
  line-height: 1.2;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.image-placeholder.pending span {
  display: block;
  max-width: 100%;
  padding: 4px;
}

.image-placeholder.loading {
  background-color: #f9f9f9;
  border-color: #999;
  color: #666;
}

.image-placeholder.error {
  background-color: #fff5f5;
  border-color: #ff9999;
  color: #cc0000;
  font-size: 48px;
  font-weight: bold;
}

.image-caption {
  margin-top: 6px;
  text-align: center;
  color: #666;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.image-caption.error-caption {
  color: #c62828;
  background-color: #fff5f5;
  padding: 4px;
  border: 1px solid #ff9999;
  border-radius: 2px;
}

.error-title {
  font-weight: bold;
  margin-bottom: 2px;
}

.error-source {
  font-size: 10px;
  font-family: monospace;
  margin-bottom: 2px;
  word-break: break-all;
}

.error-original-caption {
  font-size: 11px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid #ffcccc;
  font-style: italic;
}
</style>

