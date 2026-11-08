<template>
  <PanelTest
    title="Table Tr/Td Cross-Page Test"
    description="Testing table row (Tr) and cell (Td) pagination with multiple cells having different content lengths. First Td has short content, second Td has long TextList content that needs splitting."
    docId="test-table-tr-td"
    :paginationRef="paginationRef"
    :componentCount="testData.length"
    @runPagination="handleRunPagination"
  >
    <template #original-content>
      <div style="padding: 20px; max-width: 800px;">
        <h3>Original Content (Non-Paginated)</h3>
        <Doc docId="test-table-tr-td-original">
          <component
            v-for="(comp, idx) in testData"
            :key="idx"
            :is="getComponent(comp.type)"
            v-bind="comp.data"
          />
        </Doc>
      </div>
    </template>
    
    <template #content>
      <Pagination
        ref="paginationRef"
        docId="test-table-tr-td"
        :pageHeight="pageHeight"
        :pagePadding="{ top: 40, bottom: 40, left: 40, right: 40 }"
        :docDataInit="testData"
      />
    </template>
  </PanelTest>
</template>

<script setup>
import { ref } from 'vue'
import Pagination from '@/pagination/Pagination.vue'
import PanelTest from './panel_test.vue'
import Doc from '@/pagination/component_core/Doc.vue'
import Text from '@/pagination/component/Text.vue'
import TextList from '@/pagination/component/TextList.vue'
import Table from '@/pagination/component/Table.vue'
import TableTr from '@/pagination/component/TableTr.vue'
import TableTd from '@/pagination/component/TableTd.vue'

// Component mapping
const getComponent = (type) => {
  const componentMap = {
    'Text': Text,
    'TextList': TextList,
    'Table': Table,
    'Tr': TableTr,
    'Td': TableTd
  }
  return componentMap[type] || 'div'
}

const paginationRef = ref(null)
const pageHeight = ref(300)

const testData = [
  {
    type: 'Table',
    data: {
      rows: [
        {
          type: 'Tr',
          data: {
            items: [
              {
                items: [
                  {
                    type: 'Text',
                    data: {
                      content: 'Short cell content'
                    }
                  }
                ],
                widthRatio: 0.3
              },
              {
                items: [
                  {
                    type: 'TextList',
                    data: {
                      mode: 'unordered',
                      items: [
                        { content: 'First list item with some content. '.repeat(20) },
                        { content: 'Second list item with more content. '.repeat(25) },
                        { content: 'Third list item. '.repeat(15) },
                        { content: 'Fourth list item. '.repeat(10) }
                      ]
                    }
                  }
                ],
                widthRatio: 0.7
              }
            ]
          }
        },
        {
          type: 'Tr',
          data: {
            items: [
              {
                items: [
                  {
                    type: 'Text',
                    data: {
                      content: 'Another short cell'
                    }
                  }
                ],
                widthRatio: 0.3
              },
              {
                items: [
                  {
                    type: 'Text',
                    data: {
                      content: 'Another cell with moderate content that fits in one page'
                    }
                  }
                ],
                widthRatio: 0.7
              }
            ]
          }
        }
      ]
    }
  }
]

const handleRunPagination = () => {
  if (paginationRef.value) {
    paginationRef.value.runPagination()
  }
}
</script>

