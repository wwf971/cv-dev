<template>
  <PanelTest
    title="Image/ImageRow Pagination Test"
    description="Test data-driven pagination for Image and ImageRow components."
    doc-id="test-image-row"
    :pagination-ref="paginationRef"
    :component-count="docData.length"
    :logs="logs"
    @run-pagination="runPagination"
    @clear-logs="clearLogs"
  >
    <template #extra-buttons>
      <button @click="fetchImageData" class="control-button" :disabled="isFetching || shouldFetchImages">
        {{ isFetching ? 'Fetching...' : shouldFetchImages ? 'Images Loaded' : 'Fetch Image Data' }}
      </button>
    </template>

    <template #extra-info>
      <div class="info-row">
        <span>Image Fetch Status:</span>
        <span>{{ shouldFetchImages ? 'Loaded' : 'Not Fetched' }}</span>
      </div>
      
      <div class="description" style="margin-top: 20px;">
        <strong>Test Instructions:</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Images show "⋯" (pending) placeholder before fetch - NOT fetching yet</li>
          <li>Click "Fetch Image Data" button to start loading all images</li>
          <li>Pending → "Loading..." → Loaded or Error states</li>
          <li>Check line breaks with 7 large images (150px each)</li>
          <li>Check page splits with large images (300px)</li>
          <li>Check error states for invalid image sources</li>
        </ul>
      </div>
    </template>

    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-image-row-original">
          <component
            v-for="(comp, idx) in docData"
            :key="idx"
            :is="getComponent(comp.type)"
            v-bind="comp.data"
          />
        </Doc>
      </div>
    </template>

    <template #content>
      <PaginationWrapper
        ref="paginationRef"
        docId="image_row_test"
        :docDataInit="docData"
        :logger="logger"
      />
    </template>
  </PanelTest>
</template>


<script setup>
import { ref, provide } from 'vue'
import PanelTest from './panel_test.vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import ImageRow from '@/pagination/component/ImageRow.vue'
import Image from '@/pagination/component/Image.vue'
import VSpace from '@/pagination/component/VSpace.vue'
import TextRow from '@/pagination/component/TextRow.vue'
import Text from '@/pagination/component/Text.vue'
import { PAGE_SIZES } from '@/config.js'
import { LogType } from '@/pagination/LogTypes'
import { createLogger } from './logger'

const paginationRef = ref(null)
const logs = ref([])
const shouldFetchImages = ref(false)

const logger = createLogger(logs.value, 'panel_test_image_row')

// Provide the fetch control flag to all Image components
provide('shouldFetchImages', shouldFetchImages)

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'ImageRow': ImageRow,
    'Image': Image,
    'VSpace': VSpace,
    'TextRow': TextRow,
    'Text': Text
  }
  return componentMap[type] || 'div'
}

// Test data with various image configurations
const docData = ref([
  // Title
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: 'Image Component Test Cases',
            fontWeight: 'bold',
            fontSize: '18px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 10 } },

  // Section 1: Single Images with Different Dimensions
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '1. Single Images (10 images with different dimensions)',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  // Image 1: width=100px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '100px',
            caption: 'Image 1: width=100px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 2: width=150px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Image 2: width=150px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 3: height=80px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            height: '80px',
            caption: 'Image 3: height=80px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 4: width=200px, height=100px (fixed both)
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '200px',
            height: '100px',
            caption: 'Image 4: width=200px, height=100px (fixed, no aspect ratio)'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 5: width=120px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '120px',
            caption: 'Image 5: width=120px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 6: height=100px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            height: '100px',
            caption: 'Image 6: height=100px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 7: width=180px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '180px',
            caption: 'Image 7: width=180px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 8: width=90px, height=90px (square)
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '90px',
            height: '90px',
            caption: 'Image 8: width=90px, height=90px (square)'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 9: width=140px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '140px',
            caption: 'Image 9: width=140px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  // Image 10: height=120px
  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            height: '120px',
            caption: 'Image 10: height=120px'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 15 } },

  // Section 2: Image Row with Line Break
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '2. Image Row with Auto Line Break (7 images in one row - should wrap)',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 1'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 2'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 3'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 4'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 5'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 6'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '150px',
            caption: 'Img 7'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 15 } },

  // Section 3: Large Images for Page Split Testing
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '3. Large Images for Page Split Testing',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '300px',
            caption: 'Large Image 1 (300px) - This should trigger page split if near bottom'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 10 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '300px',
            caption: 'Large Image 2 (300px)'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 10 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '300px',
            caption: 'Large Image 3 (300px)'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 15 } },

  // Section 4: Error Handling - Invalid Image Paths
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '4. Error Handling - Invalid Image Sources',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/nonexistent-image.png}}',
            width: '150px',
            caption: 'Error Test 1: Nonexistent local file'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{mongo:invalid-access-point/invalid/path.jpg}}',
            width: '150px',
            caption: 'Error Test 2: Invalid MongoDB path'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{remote:invalid/path/image.jpg}}',
            width: '150px',
            caption: 'Error Test 3: Invalid remote path'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 15 } },

  // Section 5: Mixed Row - Good and Bad Images
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '5. Mixed Row - Valid and Invalid Images',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '120px',
            caption: 'Valid'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/missing.png}}',
            width: '120px',
            caption: 'Invalid'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '120px',
            caption: 'Valid'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{mongo:bad/path.jpg}}',
            width: '120px',
            caption: 'Invalid'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 15 } },

  // Section 6: Images Without Captions
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '6. Images Without Captions',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '130px'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '130px'
          }
        },
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '130px'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 15 } },

  // Section 7: Caption Width Strategy
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '7. Caption Width Strategy Testing',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 8 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '120px',
            caption: 'This is a very long caption that should wrap to multiple lines and stay within image width boundary',
            captionSizeStrategy: 'sameWidth'
          }
        }
      ]
    }
  },
  { type: 'VSpace', data: { height: 5 } },

  {
    type: 'ImageRow',
    data: {
      items: [
        {
          type: 'Image',
          data: {
            src: '{{local:asset/example-image.png}}',
            width: '120px',
            caption: 'Natural width caption (no constraint)',
            captionSizeStrategy: 'natural'
          }
        }
      ]
    }
  },

  { type: 'VSpace', data: { height: 20 } },

  // End marker
  {
    type: 'TextRow',
    data: {
      items: [
        {
          type: 'Text',
          data: {
            content: '--- End of Image Tests ---',
            fontWeight: 'bold',
            fontSize: '14px'
          }
        }
      ]
    }
  }
])

const isFetching = ref(false)

const runPagination = async () => {
  if (paginationRef.value) {
    logger.addLog('Starting pagination', 'runPagination', LogType.Normal)
    paginationRef.value.setDocData(docData.value)
    logger.addLog('Set doc data, running pagination', 'runPagination', LogType.Normal)
    await paginationRef.value.runPagination()
    logger.addLog('Pagination completed', 'runPagination', LogType.Normal)

    // Merge pagination logs into display logs
    const paginationLogs = paginationRef.value.getLogs()
    logger.addLog(`Retrieved ${paginationLogs ? paginationLogs.length : 'null'} pagination logs`, 'runPagination', LogType.Normal)
    if (paginationLogs && paginationLogs.length > 0) {
      logs.value = [...logs.value, ...paginationLogs]
      logger.addLog(`Merged ${paginationLogs.length} pagination logs`, 'runPagination', LogType.Normal)
    } else {
      logger.addLog('No pagination logs to merge', 'runPagination', LogType.Normal)
    }
  } else {
    logger.addLog('Pagination ref not available', 'runPagination', LogType.Error)
  }
}

const clearLogs = () => {
  logs.value = []
}

const fetchImageData = () => {
  isFetching.value = true
  logger.addLog('Starting image data fetch', 'fetchImageData', LogType.Normal)
  
  // Enable fetching for all Image components
  shouldFetchImages.value = true
  
  setTimeout(() => {
    isFetching.value = false
    logger.addLog('Image data fetch completed', 'fetchImageData', LogType.Normal)
    
    if (paginationRef.value) {
      paginationRef.value.refresh()
    }
  }, 100)
}
</script>

<style scoped>
@import './panel_styles.css';
</style>
