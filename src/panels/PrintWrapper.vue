<template>
  <!-- Dynamic @page rule based on max dimensions -->
  <component :is="'style'">
    @media print {
      @page {
        size: {{ maxPageDimensions.widthMm }}mm {{ maxPageDimensions.heightMm }}mm;
        margin: 0;
      }
    }
  </component>

  <div class="print-wrapper print-mode-active">
    <!-- Control buttons (hidden in print) -->
    <div class="print-controls no-print">
      <button @click="goBack" class="control-button">
        ← Go Back
      </button>
      <button @click="handlePrint" class="control-button print-button" :disabled="pages.length === 0">
        🖨️ Print
      </button>
    </div>

    <!-- Error/Loading State -->
    <div v-if="pages.length === 0" class="empty-state">
      <p>No pages available. Please run pagination first.</p>
    </div>

    <!-- Pages container (data-driven, same as Pagination.vue) -->
    <div v-else class="pages-container">
      <Doc :docId="'print-preview'">
        <div 
          v-for="(page, pageIndex) in pages" 
          :key="pageIndex"
          class="print-page"
        >
          <Page 
            :pageIndex="page.sizes.pageIndex"
            :pageStartY="page.sizes.pageStartY ?? null"
            :pageEndY="page.sizes.pageEndY ?? null"
            :pageWidth="pageWidth"
            :pageHeight="page.sizes.pageHeight"
            :padding="page.sizes.padding"
            :hidePageLines="true"
          >
            <component
              v-for="(comp, compIndex) in page.components"
              :key="`${pageIndex}-${compIndex}`"
              :is="getComponent(comp.type)"
              v-bind="comp.data"
            />
          </Page>
        </div>
      </Doc>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Doc from '@/pagination/component_core/Doc.vue'
import Page from '@/pagination/component_core/Page.vue'
import Text from '@/pagination/component/Text.vue'
import TextList from '@/pagination/component/TextList.vue'
import Tr from '@/pagination/component/TableTr.vue'
import Td from '@/pagination/component/TableTd.vue'
import Table from '@/pagination/component/Table.vue'
import VSpace from '@/pagination/component/VSpace.vue'
import BasicInfoJp from '@/content/CvJp/BasicInfoJp.vue'

const props = defineProps({
  pages: {
    type: Array,
    required: true,
    default: () => []
  },
  docData: {
    type: Array,
    required: true,
    default: () => []
  },
  pageWidth: {
    type: Number,
    default: 793.92
  }
})

const emit = defineEmits(['back'])

// Calculate max dimensions for @page size
const maxPageDimensions = computed(() => {
  if (!props.pages || props.pages.length === 0) {
    return { width: 794, height: 1123, widthMm: 210, heightMm: 297 } // Default A4
  }
  
  const maxWidth = Math.max(...props.pages.map(p => props.pageWidth || 794))
  const maxHeight = Math.max(...props.pages.map(p => p.sizes.pageHeight))
  
  // Convert px to mm (96 DPI standard: 1px = 0.264583mm)
  const widthMm = Math.ceil(maxWidth * 0.264583)
  const heightMm = Math.ceil(maxHeight * 0.264583)
  
  return { width: maxWidth, height: maxHeight, widthMm, heightMm }
})

console.log(`[PrintWrapper] Received ${props.pages.length} pages (data-driven)`)
console.log('[PrintWrapper] First page:', props.pages[0])
console.log('[PrintWrapper] DocData length:', props.docData.length)
console.log('[PrintWrapper] Max page dimensions:', maxPageDimensions.value)

// Component mapping (same as Pagination.vue)
const getComponent = (type) => {
  const componentMap = {
    'Text': Text,
    'TextList': TextList,
    'Tr': Tr,
    'Td': Td,
    'Table': Table,
    'VSpace': VSpace,
    'BasicInfoJp': BasicInfoJp
  }
  return componentMap[type] || 'div'
}

const goBack = () => {
  emit('back')
}

const handlePrint = () => {
  console.log('[PrintWrapper] Printing...')
  console.log(`[PrintWrapper] Number of pages: ${props.pages.length}`)
  console.log(`[PrintWrapper] PDF page size: ${maxPageDimensions.value.widthMm}mm × ${maxPageDimensions.value.heightMm}mm`)
  
  const printPages = document.querySelectorAll('.print-page')
  console.log(`[PrintWrapper] Number of .print-page elements: ${printPages.length}`)
  
  printPages.forEach((page, i) => {
    const pageContainer = page.querySelector('.page-container')
    const isLast = i === printPages.length - 1
    const tables = pageContainer?.querySelectorAll('.form-table')
    
    console.log(`  Page ${i} (${isLast ? 'LAST' : 'not-last'}):`)
    console.log(`    .print-page: ${page.offsetWidth}×${page.offsetHeight}`)
    console.log(`    .page-container: ${pageContainer?.offsetWidth}×${pageContainer?.offsetHeight}`)
    if (tables && tables.length > 0) {
      console.log(`    First table: ${tables[0].offsetWidth}px`)
    }
  })
  
  window.print()
}
</script>

<style>
/* Import shared CV styles globally for all paginated components */
@import '@/content/CvJp/styles-shared.css';

/* Note: @page size is set dynamically in template based on max page dimensions */

/* UNSCOPED print styles - Override all screen styles */
@media print {
  html, body {
    width: 100%;
    height: auto;
    margin: 0;
    padding: 0;
  }
  
  /* Critical: Force exact colors */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Hide controls */
  .no-print {
    display: none !important;
  }
  
  /* Print wrapper fills width, flows vertically */
  .print-wrapper {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
  
  /* Pages container - vertical flow */
  .pages-container {
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 0 !important;
    width: 100% !important;
  }
  
  /* Each print-page is a separate page with page break */
  .print-page {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: white !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    page-break-inside: avoid !important;
    page-break-after: always !important;
    overflow: visible !important;
  }
  
  /* Last page should not force a break */
  .print-page:last-child {
    page-break-after: auto !important;
  }
  
  /* Page container should fill width */
  .print-page .page-container {
    border: none !important;
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  
  /* Force tables to use full width */
  .print-page {
    width: 100% !important;
    max-width: 100% !important;
  }
}
</style>

<style scoped>
.print-wrapper {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  overflow: auto;
}

.print-controls {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: white;
  border-bottom: 1px solid #ddd;
  padding: 12px 20px;
  display: flex;
  gap: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.control-button {
  padding: 8px 16px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.control-button:hover {
  background-color: #0052a3;
}

.print-button {
  background-color: #28a745;
}

.print-button:hover {
  background-color: #218838;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.empty-state p {
  margin: 0;
}

/* Screen-only styles for pages-container */
@media screen {
  .pages-container {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }
}

/* Screen-only styles for print-page */
@media screen {
  .print-page {
    padding: 20px;
    margin-bottom: 20px;
    background-color: #f5f5f5;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
}

</style>

