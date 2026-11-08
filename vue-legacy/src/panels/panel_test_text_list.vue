<template>
  <PanelTest
    title="TextList Cross-Page Test"
    description="Test data-driven pagination for lists (ordered/unordered/paragraph) that span across pages."
    doc-id="test-textlist-cross-page"
    :pagination-ref="paginationRef"
    :component-count="docData.length"
    @run-pagination="runPagination"
  >
    <template #extra-buttons>
      <button @click="addMoreListItems" class="control-button">
        Add More Items
      </button>
      <button @click="toggleListMode" class="control-button">
        Mode: {{ currentMode }}
      </button>
    </template>

    <template #extra-info>
      <div class="description" style="margin-top: 20px;">
        <strong>TextList Features:</strong><br/>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Supports ordered, unordered, and paragraph modes</li>
          <li>Nested pagination logic</li>
          <li>Bullet number tracking across splits</li>
          <li>Invisible bullet placeholders for split children</li>
        </ul>
      </div>
    </template>

    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-textlist-cross-page-original">
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
        docId="test-textlist-cross-page"
        :pageHeight="PAGE_SIZES.pageHeight"
        :pagePadding="{ top: PAGE_SIZES.paddingTop, bottom: PAGE_SIZES.paddingBottom, left: PAGE_SIZES.paddingLeft, right: PAGE_SIZES.paddingRight }"
      />
    </template>
  </PanelTest>
</template>

<script setup>
import { ref } from 'vue'
import PaginationWrapper from '../pagination/Pagination.vue'
import PanelTest from './panel_test.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import TextList from '@/pagination/component/TextList.vue'
import { PAGE_SIZES } from '@/config.js'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'TextList': TextList
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const currentMode = ref('ordered')

// Sample doc data with TextList
const docData = ref([
  {
    type: 'TextList',
    data: {
      mode: 'ordered',
      startBulletNumber: 1,
      items: [
        {
          content: 'First list item with some text. '.repeat(30)
        },
        {
          content: 'Second list item with more content. '.repeat(40)
        },
        {
          content: 'Third list item. '.repeat(35)
        },
        {
          content: 'Fourth list item with even more text to test pagination. '.repeat(50)
        }
      ]
    }
  }
])

const runPagination = () => {
  if (paginationRef.value) {
    paginationRef.value.setDocData(docData.value)
    paginationRef.value.runPagination()
  }
}

const addMoreListItems = () => {
  if (docData.value[0] && docData.value[0].type === 'TextList') {
    docData.value[0].data.items.push({
      content: `New item added at ${new Date().toLocaleTimeString()}. `.repeat(20)
    })
  }
}

const toggleListMode = () => {
  const modes = ['ordered', 'unordered', 'paragraph']
  const currentIndex = modes.indexOf(currentMode.value)
  currentMode.value = modes[(currentIndex + 1) % modes.length]
  
  if (docData.value[0] && docData.value[0].type === 'TextList') {
    docData.value[0].data.mode = currentMode.value
  }
}
</script>

<style scoped>
</style>

